---
id: TASK-4
title: tmux-usage-limits engine.ts tmuxBraille の pct を 0-100 にクランプする
status: To Do
assignee: []
created_date: '2026-07-13 03:20'
updated_date: '2026-07-13 03:20'
labels:
  - plugin
  - tech-debt
dependencies: []
priority: low
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景
task-49(dotfiles TASK-49 参照) のローカルレビューで CodeRabbit (2026-07-12) が engine.ts:198-208 tmuxBraille を指摘。task-49(dotfiles TASK-49 参照) スコープ外の follow-up。適用前に妥当性検証すること。

## 内容
tmuxBraille 冒頭で pct を 0-100 にクランプし、その値で steps/cur/full/partial/color を算出する。100 超や負値で無効な repeat 回数やバーが生成されないようにする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pct のクランプを追加し、境界値 (負値/100超) のテストが pass
- [ ] #2 bun test src/engine.test.ts が pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-13: dotfiles TASK-55 から per-repo backlog へ移行。TASK-75(dotfiles TASK-75 参照) の分類で tmuxBraille は core ではなく rendering 資産と確定。新 master でも対象は src/engine.ts:tmuxBraille に残っていることを確認済み。
<!-- SECTION:NOTES:END -->
