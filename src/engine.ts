#!/usr/bin/env bun

import { homedir } from "os";
import {
  fableFromLimits,
  fetchAndCacheUsage,
  getClaudeToken,
  getCodexToken,
  keychainToken,
  normalizeCodexUsage,
  resolveUsageData,
  type LimitEntry,
  type UsageLimits,
} from "./usage-limits-core";

export {
  compute429Record,
  computeStaleness,
  fableFromLimits,
  normalizeCodexUsage,
  parseCache,
  parseRetryAfter,
  shouldFetchNow,
  shouldShowStaleMark,
} from "./usage-limits-core";

const HOME = homedir();
const CLAUDE_CACHE_FILE = `${HOME}/.claude/data/usage-limits-cache.json`;
const CLAUDE_CRED_FILE = `${HOME}/.claude/.credentials.json`;
const CODEX_CACHE_FILE = `${HOME}/.codex/cache/tmux-usage-limits-cache.json`;
const CODEX_AUTH_FILE = `${HOME}/.codex/auth.json`;

const t = {
  gray: "#[fg=colour240]",
  white: "#[fg=white]",
  yellow: "#[fg=yellow]",
  orange: "#[fg=colour208]",
  red: "#[fg=brightred]",
  reset: "#[default]",
} as const;

export function tmuxBraille(pct: number, len = 5): string {
  const chars = ["⣀", "⣄", "⣤", "⣦", "⣶", "⣷", "⣿"];
  const steps = len * (chars.length - 1);
  const cur = Math.round((pct / 100) * steps);
  const full = Math.floor(cur / (chars.length - 1));
  const partial = cur % (chars.length - 1);
  const empty = len - full - (partial > 0 ? 1 : 0);
  const bar = "⣿".repeat(full) + (partial > 0 ? chars[partial] : "") + "⣀".repeat(empty);
  const color = pct > 90 ? t.red : pct > 70 ? t.orange : pct > 50 ? t.yellow : t.gray;
  return `${color}${bar}${t.reset}`;
}

export function resetTime(resetsAt: string): string {
  const diff = new Date(resetsAt).getTime() - Date.now();
  if (diff <= 0) return "now";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d${h % 24}h`;
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

export function resetDate(resetsAt: string): string {
  const rd = new Date(resetsAt);
  const now = new Date();
  const time = rd.toLocaleString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
    hour12: false,
  });
  const dateStr = rd.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  const nowStr = now.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  if (dateStr === nowStr) return time;
  const mo = rd
    .toLocaleDateString("ja-JP", { month: "numeric", timeZone: "Asia/Tokyo" })
    .replace(/月/g, "");
  const da = rd
    .toLocaleDateString("ja-JP", { day: "numeric", timeZone: "Asia/Tokyo" })
    .replace(/日/g, "");
  return `${mo}/${da} ${time}`;
}

function formatLimit(label: string, limit: LimitEntry, staleMark: string): string {
  let s = `${t.gray}${label}${staleMark}:${t.reset}${tmuxBraille(limit.utilization)} ${t.white}${limit.utilization}${t.reset}${t.gray}%${t.reset}`;
  if (limit.resets_at) {
    s += ` ${t.gray}(${resetDate(limit.resets_at)}|${resetTime(limit.resets_at)})${t.reset}`;
  }
  return s;
}

async function collectParts(args: {
  labels: { fiveHour: string; sevenDay: string; fable?: string };
  cacheFile: string;
  fetchAndCache: () => Promise<void>;
  now: number;
}): Promise<string[]> {
  const resolved = await resolveUsageData({
    cacheFile: args.cacheFile,
    fetchAndCache: args.fetchAndCache,
    now: args.now,
  });

  if (!resolved.data) return [];

  const mark = resolved.showStale ? "?" : "";
  const parts: string[] = [];
  if (resolved.data.five_hour)
    parts.push(formatLimit(args.labels.fiveHour, resolved.data.five_hour, mark));
  if (resolved.data.seven_day)
    parts.push(formatLimit(args.labels.sevenDay, resolved.data.seven_day, mark));
  if (args.labels.fable) {
    const fable = fableFromLimits(resolved.data.limits);
    if (fable) parts.push(formatLimit(args.labels.fable, fable, mark));
  }
  if (resolved.showStale) {
    parts.push(`${t.gray}(${Math.floor(resolved.ageMs / 60000)}m ago)${t.reset}`);
  }

  return parts;
}

async function fetchAndCacheClaudeLimits(now: number): Promise<void> {
  const token = await getClaudeToken({
    credentialsFile: CLAUDE_CRED_FILE,
    keychainFallback: () => keychainToken("Claude Code-credentials"),
  });
  await fetchAndCacheUsage({
    cacheFile: CLAUDE_CACHE_FILE,
    token,
    url: "https://api.anthropic.com/api/oauth/usage",
    headers: {
      "Content-Type": "application/json",
      "anthropic-beta": "oauth-2025-04-20",
    },
    now,
  });
}

async function fetchAndCacheCodexLimits(now: number): Promise<void> {
  const token = await getCodexToken({ authFile: CODEX_AUTH_FILE });
  await fetchAndCacheUsage({
    cacheFile: CODEX_CACHE_FILE,
    token,
    url: "https://chatgpt.com/backend-api/wham/usage",
    headers: {
      Accept: "application/json",
    },
    normalize: (raw: unknown): UsageLimits => normalizeCodexUsage(raw as Parameters<typeof normalizeCodexUsage>[0]),
    now,
  });
}

async function main(): Promise<void> {
  try {
    console.log(await getUsageStatus());
  } catch {
    console.log("");
  }
}

export async function getUsageStatus(now = Date.now()): Promise<string> {
  const [claudeParts, codexParts] = await Promise.all([
    collectParts({
      labels: { fiveHour: "CC5", sevenDay: "CCW", fable: "CCF" },
      cacheFile: CLAUDE_CACHE_FILE,
      fetchAndCache: () => fetchAndCacheClaudeLimits(now),
      now,
    }),
    collectParts({
      labels: { fiveHour: "CX5", sevenDay: "CXW" },
      cacheFile: CODEX_CACHE_FILE,
      fetchAndCache: () => fetchAndCacheCodexLimits(now),
      now,
    }),
  ]);

  return [...claudeParts, ...codexParts].join(" ");
}

if (import.meta.main) {
  await main();
}
