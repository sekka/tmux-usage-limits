---
id: TASK-5
title: tmux-usage-limits engine.test.ts のテスト網羅性を強化する
status: Done
assignee: []
created_date: '2026-07-13 03:20'
updated_date: '2026-07-22 00:00'
labels:
  - plugin
  - tech-debt
  - test
dependencies: []
priority: low
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 背景
task-49(dotfiles TASK-49 参照) のローカルレビューで CodeRabbit (2026-07-12) が engine.test.ts の既存テストに網羅性の指摘を挙げた。task-49(dotfiles TASK-49 参照) スコープ外の follow-up。適用前に妥当性検証すること。

## 内容
- fableFromLimits の「limits が null/undefined/非配列 → null」テストに、非配列の無効入力 (オブジェクトや文字列) のケースを追加
- 50% tmuxBraille テストの hasPartialFill || hasFullFill という広い assertion を、50% に対応する具体的な braille 文字列/塗りドット数の期待値に置き換え、100% 満杯バーでは通らないようにする
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 上記2テストを具体化し、全テストが pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-13: dotfiles TASK-56 から per-repo backlog へ移行。TASK-75(dotfiles TASK-75 参照) の分類で engine.test.ts は tmux-usage-limits 固有の rendering test 資産と確定。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
50% tmuxBraille テストを exact 期待値 `⣿⣿⣦⣀⣀` (toBe) に置き換え、100% 満杯バーでは通らない assertion にした。fableFromLimits 非配列テストにオブジェクト / array-like / 文字列 / 数値ケースを追加。bun test 79 件全パス。
<!-- SECTION:FINAL_SUMMARY:END -->
