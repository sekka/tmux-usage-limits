---
id: TASK-3
title: tmux-usage-limits verify.ts のエラーハンドリング/堅牢性を強化する
status: To Do
assignee: []
created_date: '2026-07-13 03:20'
updated_date: '2026-07-13 03:20'
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
- [ ] #1 各 CodeRabbit 指摘を現行コードで検証し、valid なもののみ修正した
- [ ] #2 bun test と ./verify/verify.sh が pass
- [ ] #3 ローカルレビューゲート通過
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-13: dotfiles TASK-54 から per-repo backlog へ移行。TASK-75(dotfiles TASK-75 参照) の分類で verify.ts は tmux-usage-limits 固有の verify ハーネス資産と確定。
<!-- SECTION:NOTES:END -->
