#!/usr/bin/env bun
// Generic, plugin-agnostic herdr-plugin verification harness.
//
// This file contains ZERO plugin-specific knowledge. Everything about a
// concrete plugin (which cache files it reads, which commands to run, which
// tokens must appear/must-not-appear in the rendered output) lives in
// verify/manifest.json + verify/fixtures/*. See verify/README.md for how
// another herdr plugin adopts this mechanism.
//
// Modes:
//   bun verify.ts              source mode: run checks from this working tree
//   bun verify.ts --installed  also run checks against the installed plugin copy
//   bun verify.ts --self-test  prove the assertion engine is not a no-op (no subprocess)

import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { homedir, tmpdir } from "os";
import path from "path";

const REPO_ROOT = path.dirname(import.meta.dir);
const VERIFY_DIR = import.meta.dir;

// ============================================================================
// Manifest types (plugin-agnostic contract)
// ============================================================================

interface FixtureSpec {
  home_path: string;
  template: string;
  mode?: string;
}

interface CheckSpec {
  name: string;
  cmd: string[];
  mode: "oneshot" | "render-once";
  timeout_ms?: number;
  expect_present?: string[];
  expect_absent?: string[];
  best_effort?: boolean;
}

interface Manifest {
  plugin_id?: string;
  fixtures: FixtureSpec[];
  checks: CheckSpec[];
}

function loadManifest(): Manifest {
  const raw = readFileSync(path.join(VERIFY_DIR, "manifest.json"), "utf8");
  return JSON.parse(raw) as Manifest;
}

// ============================================================================
// Assertion engine (pure, no subprocess, no network — exercised by --self-test)
// ============================================================================

// Strip both tmux markup (`#[fg=...]`, `#[default]`) and ANSI escapes
// (CSI sequences like `\x1b[2J`, `\x1b[H`, `\x1b[38;5;240m`) so substring
// assertions match the logical text regardless of rendering layer.
export function stripMarkup(s: string): string {
  return s
    .replace(/#\[[^\]]*\]/g, "")
    .replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
}

export interface AssertResult {
  pass: boolean;
  missing: string[];
  forbidden: string[];
  stripped: string;
}

export function assertTokens(
  output: string,
  expectPresent: string[] = [],
  expectAbsent: string[] = [],
): AssertResult {
  const stripped = stripMarkup(output);
  const missing = expectPresent.filter((t) => !stripped.includes(t));
  const forbidden = expectAbsent.filter((t) => stripped.includes(t));
  return { pass: missing.length === 0 && forbidden.length === 0, missing, forbidden, stripped };
}

function selfTest(): boolean {
  // Case 1: an expected token is missing — engine must report it as missing.
  const missingCase = assertTokens("CC5:41% CCW:12%", ["CC5", "CCW", "CCF"], ["CCS"]);
  const detectedMissing = !missingCase.pass && missingCase.missing.includes("CCF");

  // Case 2: a forbidden token is present — engine must report it as forbidden.
  const forbiddenCase = assertTokens("CC5:41% CCS:99%", ["CC5"], ["CCS"]);
  const detectedForbidden = !forbiddenCase.pass && forbiddenCase.forbidden.includes("CCS");

  // Case 3: a genuinely matching case must still pass (no false positive).
  const okCase = assertTokens("#[fg=white]CC5:#[default]41% CCW:12%", ["CC5", "CCW"], ["CCS"]);
  const noFalsePositive = okCase.pass;

  console.log(`[self-test] missing-token detection: ${detectedMissing ? "OK" : "FAIL"}`);
  console.log(`[self-test] forbidden-token detection: ${detectedForbidden ? "OK" : "FAIL"}`);
  console.log(`[self-test] no false positive on matching case: ${noFalsePositive ? "OK" : "FAIL"}`);

  return detectedMissing && detectedForbidden && noFalsePositive;
}

// ============================================================================
// Fixture HOME setup
// ============================================================================

function setupFixtureHome(manifest: Manifest): string {
  const home = mkdtempSync(path.join(tmpdir(), "hverify-"));
  const now = String(Date.now());
  try {
    for (const fixture of manifest.fixtures) {
      const templatePath = path.join(VERIFY_DIR, fixture.template);
      const rendered = readFileSync(templatePath, "utf8").replaceAll("__TIMESTAMP__", now);
      const destPath = path.join(home, fixture.home_path);
      mkdirSync(path.dirname(destPath), { recursive: true, mode: 0o700 });
      writeFileSync(destPath, rendered);
      chmodSync(destPath, parseInt(fixture.mode ?? "0600", 8));
    }
  } catch (e) {
    rmSync(home, { recursive: true, force: true });
    throw e;
  }
  return home;
}

// Child env: isolate HOME to the fixture, and scrub herdr session variables
// so a check run from inside a live herdr session cannot mutate the real
// session (sidebar status report, outer window title) as a side effect of
// verification. This matters because HERDR_PANE_ID/HERDR_SOCKET_PATH are
// ambient env vars, not something the fixture HOME can shadow.
function buildChildEnv(fixtureHome: string): Record<string, string> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  env.HOME = fixtureHome;
  delete env.HERDR_PANE_ID;
  delete env.HERDR_BIN_PATH;
  env.HERDR_SOCKET_PATH = path.join(fixtureHome, "herdr-verify-unreachable.sock");
  return env;
}

// ============================================================================
// Check runners
// ============================================================================

interface RunOutcome {
  stdout: string;
  error?: string;
}

async function runOneshot(
  cmd: string[],
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
): Promise<RunOutcome> {
  try {
    const proc = Bun.spawn({
      cmd,
      cwd,
      env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      timeout: timeoutMs,
      killSignal: "SIGKILL",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) {
      return { stdout, error: `exited ${code}: ${stderr.trim().slice(0, 300)}` };
    }
    return { stdout };
  } catch (e) {
    return { stdout: "", error: String(e) };
  }
}

// Render-once: the target process (herdr pane display loops forever). Read
// stdout incrementally until every expected token has been observed or the
// timeout elapses, then always kill the process — never leave it running.
async function runRenderOnce(
  cmd: string[],
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
  expectPresent: string[],
): Promise<RunOutcome> {
  let proc: ReturnType<typeof Bun.spawn> | undefined;
  try {
    proc = Bun.spawn({ cmd, cwd, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  } catch (e) {
    return { stdout: "", error: String(e) };
  }

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  const deadline = Date.now() + timeoutMs;

  try {
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;

      const result = await Promise.race([
        reader.read(),
        new Promise<{ done: true; value: undefined }>((resolve) =>
          setTimeout(() => resolve({ done: true, value: undefined }), remaining),
        ),
      ]);

      if (result.done) break;
      acc += decoder.decode(result.value, { stream: true });

      const stripped = stripMarkup(acc);
      if (expectPresent.length > 0 && expectPresent.every((t) => stripped.includes(t))) break;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // reader may already be released/errored — non-fatal
    }
    try {
      proc.kill("SIGKILL");
    } catch {
      // process may have already exited — non-fatal
    }
    await proc.exited.catch(() => {});
  }

  return { stdout: acc };
}

interface CheckResult {
  name: string;
  bestEffort: boolean;
  ran: boolean;
  pass: boolean;
  missing: string[];
  forbidden: string[];
  error?: string;
}

async function runCheck(
  check: CheckSpec,
  cwd: string,
  env: Record<string, string>,
): Promise<CheckResult> {
  const bestEffort = check.best_effort ?? false;
  const outcome =
    check.mode === "render-once"
      ? await runRenderOnce(
          check.cmd,
          cwd,
          env,
          check.timeout_ms ?? 4000,
          check.expect_present ?? [],
        )
      : await runOneshot(check.cmd, cwd, env, check.timeout_ms ?? 4000);

  if (outcome.error && outcome.stdout === "") {
    return {
      name: check.name,
      bestEffort,
      ran: false,
      pass: false,
      missing: check.expect_present ?? [],
      forbidden: [],
      error: outcome.error,
    };
  }

  const assertion = assertTokens(outcome.stdout, check.expect_present, check.expect_absent);
  return {
    name: check.name,
    bestEffort,
    ran: true,
    // A nonzero exit is a failure even if the expected tokens happen to be
    // present in stdout — the command itself did not complete cleanly.
    pass: assertion.pass && !outcome.error,
    missing: assertion.missing,
    forbidden: assertion.forbidden,
    error: outcome.error,
  };
}

function printCheckResult(result: CheckResult, prefix: string): void {
  // best_effort only downgrades an assertion mismatch; a check that could not
  // even run is a FAIL regardless (matches runSourceMode's exit-code logic).
  const status = result.pass
    ? "PASS"
    : result.bestEffort && result.ran
      ? "WARN (best-effort)"
      : "FAIL";
  console.log(`${prefix}${result.name}: ${status}`);
  if (!result.pass) {
    if (result.missing.length > 0)
      console.log(`${prefix}  missing tokens: ${result.missing.join(", ")}`);
    if (result.forbidden.length > 0)
      console.log(`${prefix}  forbidden tokens present: ${result.forbidden.join(", ")}`);
    if (result.error) console.log(`${prefix}  error: ${result.error}`);
  }
}

// ============================================================================
// Installed-mode plugin discovery (non-fatal — install layout may be stale)
// ============================================================================

interface PluginRegistryEntry {
  plugin_id: string;
  plugin_root?: string;
  source?: { resolved_commit?: string };
}

async function runInstalledMode(manifest: Manifest): Promise<void> {
  if (!manifest.plugin_id) {
    console.log("[installed] SKIP: manifest has no herdr plugin_id");
    return;
  }

  const registryPath = path.join(homedir(), ".config", "herdr", "plugins.json");
  let entries: PluginRegistryEntry[];
  try {
    const parsed: unknown = JSON.parse(readFileSync(registryPath, "utf8"));
    if (!Array.isArray(parsed)) throw new Error("plugins.json is not an array");
    entries = parsed as PluginRegistryEntry[];
  } catch {
    console.log(
      `[installed] SKIP: could not read ${registryPath} (herdr not installed, or no plugins registered)`,
    );
    return;
  }

  const entry = entries.find((e) => e.plugin_id === manifest.plugin_id);
  if (!entry) {
    console.log(`[installed] SKIP: plugin_id "${manifest.plugin_id}" not found in plugins.json`);
    return;
  }
  if (!entry.plugin_root) {
    console.log(
      `[installed] SKIP: plugin_id "${manifest.plugin_id}" has no plugin_root in plugins.json`,
    );
    return;
  }

  try {
    const gitProc = Bun.spawn({
      cmd: ["git", "rev-parse", "HEAD"],
      cwd: REPO_ROOT,
      stdout: "pipe",
      stderr: "ignore",
    });
    const [head, gitCode] = await Promise.all([
      new Response(gitProc.stdout).text().then((s) => s.trim()),
      gitProc.exited,
    ]);
    const resolved = entry.source?.resolved_commit;
    if (gitCode === 0 && resolved && resolved !== head) {
      console.log(
        `[installed] WARNING: installed copy is at commit ${resolved.slice(0, 12)}, working tree HEAD is ${head.slice(0, 12)}.`,
      );
      console.log(
        `[installed] Reinstall hint: herdr plugin update ${manifest.plugin_id} (or reinstall from source).`,
      );
    }
  } catch {
    // git not available or not a repo — non-fatal, just skip the staleness check
  }

  console.log(`[installed] running checks against ${entry.plugin_root}`);
  const home = setupFixtureHome(manifest);
  const env = buildChildEnv(home);
  try {
    for (const check of manifest.checks) {
      const result = await runCheck(check, entry.plugin_root, env);
      // Installed-mode results are informational only (the install layout is
      // being restructured concurrently) — never affect the process exit code.
      printCheckResult(result, "[installed] ");
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

// ============================================================================
// Main
// ============================================================================

async function runSourceMode(manifest: Manifest): Promise<boolean> {
  const home = setupFixtureHome(manifest);
  const env = buildChildEnv(home);
  let ok = true;
  try {
    console.log(`[source] fixture HOME: ${home}`);
    for (const check of manifest.checks) {
      const result = await runCheck(check, REPO_ROOT, env);
      printCheckResult(result, "[source] ");
      if (!result.pass && !(result.bestEffort && result.ran)) ok = false;
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
  return ok;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--self-test")) {
    const ok = selfTest();
    console.log(
      ok
        ? "self-test: OK (assertion engine correctly detects deliberate mismatches)"
        : "self-test: FAIL",
    );
    process.exit(ok ? 0 : 1);
  }

  const manifest = loadManifest();
  const sourceOk = await runSourceMode(manifest);

  if (args.includes("--installed")) {
    await runInstalledMode(manifest);
  }

  console.log(sourceOk ? "verify: PASS" : "verify: FAIL");
  process.exit(sourceOk ? 0 : 1);
}

if (import.meta.main) {
  await main();
}
