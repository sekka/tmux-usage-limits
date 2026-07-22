---
id: TASK-3
title: tmux-usage-limits verify.ts のエラーハンドリング/堅牢性を強化する
status: Done
assignee: []
created_date: '2026-07-13 03:20'
updated_date: '2026-07-22 00:00'
labels:
  - plugin
  - tech-debt
dependencies: []
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景
task-49(dotfiles TASK-49 参照) のローカルレビューで CodeRabbit (2026-07-12) が verify/verify.ts の既存ロジックに指摘を挙げた。task-49(dotfiles TASK-49 参照) は移動のみのためスコープ外として保留した follow-up。各指摘は適用前に現行コードで妥当性を検証すること。

## 対象 (verify/verify.ts)
- runCheck: nonzero-exit でも stdout にトークンがあると pass 扱い → error があれば pass:false にする
- runInstalledMode: plugins.json が非配列のとき read/parse 失敗と同様に skip する (Array.isArray チェック)
- printCheckResult/runSourceMode: bestEffort=true かつ ran=false を WARN でなく FAIL 扱いに統一
- runOneshot: timeout_ms を Bun.spawn に渡し応答なしプロセスを終了させる
- runRenderOnce cleanup: proc.kill を SIGKILL に
- setupFixtureHome: fixture 生成失敗時に mkdtemp した home を rmSync してから rethrow
- installed-mode の git rev-parse HEAD: exited を await し exit 0 のときのみ比較
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 各 CodeRabbit 指摘を現行コードで検証し、valid なもののみ修正した
- [x] #2 bun test と ./verify/verify.sh が pass
- [ ] #3 ローカルレビューゲート通過
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-13: dotfiles TASK-54 から per-repo backlog へ移行。TASK-75(dotfiles TASK-75 参照) の分類で verify.ts は tmux-usage-limits 固有の verify ハーネス資産と確定。

2026-07-22 検証結果: 7指摘とも現行コードで valid と確認し全て修正。
- runCheck: error 時は token が揃っていても pass:false に
- runInstalledMode: plugins.json の Array.isArray チェック → 非配列は SKIP
- printCheckResult: bestEffort && !ran を WARN でなく FAIL 表示に (runSourceMode の exit 判定と一致)
- runOneshot: Bun.spawn に timeout (timeout_ms ?? 4000) + killSignal SIGKILL を指定 (bun-types bun.d.ts の Spawn OptionsObject で正式サポート確認済み)
- runRenderOnce cleanup: proc.kill("SIGKILL")
- setupFixtureHome: fixture 生成失敗時に mkdtemp した home を rmSync してから rethrow
- git rev-parse HEAD: exited を await し exit 0 のときのみ staleness 比較
<!-- SECTION:NOTES:END -->
