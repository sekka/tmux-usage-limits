#!/usr/bin/env bun
// paneless デーモン: 外側ターミナルのウィンドウタイトルを CC/Codex レート制限で
// 更新し続ける。display.ts の pane は閉じられうるため、タイトル書き込みは
// pane から切り離してこちらに集約する (herdr-plugin.toml の workspace.created
// で ensure-title-daemon.sh 経由起動)。
//
// デーモン自体が死んだ場合、タイトルは静かに固まったままになる (tab-title と
// 同じ許容レベル。80% ルールにより許容)。

import { fetchRaw, REFRESH_MS, setWindowTitle } from "./display.ts";

async function main(): Promise<void> {
  for (;;) {
    try {
      await setWindowTitle(await fetchRaw());
    } catch {
      // 次のティックまで待つ
    }
    await Bun.sleep(REFRESH_MS);
  }
}

if (import.meta.main) void main();
