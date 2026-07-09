# Deterministic plugin verification harness

## What this proves

`verify.ts` runs this plugin's REAL entrypoints (`usage_limits.tmux status`,
`run.sh`) against a fixture `$HOME` seeded with known cache-file contents, and
asserts the rendered output contains/omits the right status tokens (`CC5`,
`CCW`, `CCF`, `CX5`, `CXW` — and never the retired `CCS`).

Unit tests exercise individual functions in isolation; this harness catches
what they miss: the entrypoint-chain wiring (`usage_limits.tmux` → `engine.ts`,
`run.sh` → `display.ts`), cache parsing through the real file-system path
(`$HOME/.claude/data/...`, `$HOME/.codex/cache/...`), and label regressions
(e.g. the CCS→CCF rename) that only show up when the whole chain runs.

No network calls happen during verification: the fixture cache timestamp is
always "now", so `engine.ts`'s freshness check (`fresh` staleness) skips the
fetch path entirely regardless of whether credentials exist.

## How to run

```sh
./verify.sh                # source mode: run checks from this working tree
./verify.sh --installed    # also probe the installed plugin copy (non-fatal)
./verify.sh --self-test    # prove the assertion engine itself isn't a no-op
```

Exit code is 0 iff every non-`best_effort` check in `manifest.json` passes.
`--installed` output is informational only (SKIP/WARN) and never affects the
exit code — the install layout can be stale or mid-restructure independently
of whether the source tree is correct.

## How another herdr plugin adopts this

The runner (`verify.ts`) and wrapper (`verify.sh`) are 100% generic — they
contain no reference to this plugin's cache paths, commands, or labels.
Another plugin (e.g. `herdr-tab-title`) adopts the harness by:

1. Copying `verify.ts` and `verify.sh` into its own repo root, unmodified.
2. Writing its own `verify/manifest.json`:
   - `plugin_id` — must match the `id` in its `herdr-plugin.toml`.
   - `fixtures` — one entry per cache/state file it reads at a fixed
     `$HOME`-relative path, each with a template file and the octal file mode
     to chmod it to.
   - `checks` — one entry per entrypoint to exercise: `cmd` (argv, run with
     cwd = plugin root), `mode` (`oneshot` for a single-line print-and-exit
     entrypoint, `render-once` for a long-running pane process that must be
     captured-then-killed), `expect_present` / `expect_absent` token lists,
     and optionally `timeout_ms` / `best_effort`.
3. Writing its own `verify/fixtures/*.json` template files. Any dynamic value
   that would otherwise go stale (e.g. a cache timestamp used for a
   freshness check) should use a `__TIMESTAMP__` placeholder — the runner
   substitutes it with `Date.now()` at run time, never a hardcoded value.

No fixture, command, or token ever needs to be hardcoded into `verify.ts`
itself — that is what keeps the mechanism deterministic and portable across
plugins (the mechanism is fixed code; the plugin's specifics are data).
