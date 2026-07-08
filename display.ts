#!/usr/bin/env bun
// herdr plugin pane: CC/Codex のレート制限を表示する。
// データ取得・キャッシュは engine.ts (tmux status-right と同一実装) に委譲し、
// ここでは (1) tmux 書式→ANSI 変換して pane に描画、(2) 短縮サマリを
// pane report-agent の custom_status としてサイドバー agents 欄へ常時表示、の2つを行う。
import { homedir } from "os";
import { getUsageStatus } from "./engine.ts";

export const REFRESH_MS = 60_000;

// tmux-status.ts が使う色語彙 (const t + tmuxBraille) をカバーする基本色テーブル
const NAMED_COLORS: Record<string, string> = {
  black: "30",
  red: "31",
  green: "32",
  yellow: "33",
  blue: "34",
  magenta: "35",
  cyan: "36",
  white: "37",
  brightblack: "90",
  brightred: "91",
  brightgreen: "92",
  brightyellow: "93",
  brightblue: "94",
  brightmagenta: "95",
  brightcyan: "96",
  brightwhite: "97",
};

export function tmuxToAnsi(s: string): string {
  return s.replace(/#\[([^\]]*)\]/g, (_, spec: string) => {
    if (spec === "default") return "\x1b[0m";
    const indexed = spec.match(/^fg=colour(\d+)$/);
    if (indexed) return `\x1b[38;5;${indexed[1]}m`;
    const named = spec.match(/^fg=(\w+)$/);
    if (named && NAMED_COLORS[named[1]]) return `\x1b[${NAMED_COLORS[named[1]]}m`;
    return "";
  });
}

// tmux 書式トークンだけを除去したプレーンテキスト (tmux status-right の見た目のテキスト再現)
export function stripTmux(s: string): string {
  return s.replace(/#\[[^\]]*\]/g, "");
}

// サイドバー agents 欄 (幅 ~26col) 向けに "CC5 41% CCW 36%" 形式へ短縮する
export function shortStatus(raw: string): string {
  const pairs = [...stripTmux(raw).matchAll(/([A-Za-z]+\d*\??):\S* (\d+%)/g)];
  return pairs.map((m) => `${m[1]} ${m[2]}`).join(" ");
}

export async function fetchRaw(): Promise<string> {
  return (await getUsageStatus()).trim();
}

function reportToSidebar(raw: string): void {
  const paneId = process.env.HERDR_PANE_ID;
  if (!paneId) return;
  const status = shortStatus(raw);
  if (!status) return;
  const herdr = process.env.HERDR_BIN_PATH ?? "herdr";
  Bun.spawn(
    [
      herdr,
      "pane",
      "report-agent",
      paneId,
      "--source",
      "plugin:usage-limits",
      "--agent",
      "limits",
      "--state",
      "idle",
      "--custom-status",
      status,
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
}

// 外側ターミナルのウィンドウタイトルに tmux 表示のテキスト版を常時表示する。
// socket API client.window_title.set (herdr.dev/docs/socket-api/: newline-delimited
// JSON、"Set or clear the foreground client's outer terminal window title")。
// CLI ラッパーが無いため raw socket を直接叩く。
// タイトルバーはプロポーショナルフォントで点字ゲージの字間が崩れるため、ゲージを除いた
// テキスト ("CC5: 55% (7/6 01:10|2h20m) …") にする。
// タイトル送信は title-daemon.ts (paneless) が担う。herdr ウィンドウが複数ある場合、
// どのフォアグラウンドクライアントがこのタイトルを受け取るかは未定義 (単一ユーザー運用のため許容)。
export function titleText(raw: string): string {
  return stripTmux(raw)
    .replace(/[⠀-⣿]+/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}

export async function setWindowTitle(raw: string): Promise<void> {
  const title = titleText(raw);
  if (!title) return;
  const sock = process.env.HERDR_SOCKET_PATH ?? `${homedir()}/.config/herdr/herdr.sock`;
  try {
    const conn = await Bun.connect({
      unix: sock,
      socket: { data() {}, error() {} },
    });
    conn.write(
      `${JSON.stringify({ id: "usage-limits:title", method: "client.window_title.set", params: { title } })}\n`,
    );
    setTimeout(() => conn.end(), 500);
  } catch {
    // herdr 不在時 (単体実行時など) は黙って諦める
  }
}

async function render(): Promise<void> {
  const raw = await fetchRaw();
  const body = raw ? tmuxToAnsi(raw) : "(データなし — 認証またはキャッシュを確認)";

  console.write("\x1b[2J\x1b[H");
  console.log(
    "\x1b[1mCC / Codex Usage Limits\x1b[0m  \x1b[38;5;240m(60秒ごと自動更新 / q で閉じる)\x1b[0m",
  );
  console.log("");
  console.log(body);

  reportToSidebar(raw);
}

if (import.meta.main) {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (d: Buffer) => {
      const key = d.toString();
      if (key === "q" || key === "\x03") process.exit(0);
    });
  }
  await render();
  setInterval(render, REFRESH_MS);
}
