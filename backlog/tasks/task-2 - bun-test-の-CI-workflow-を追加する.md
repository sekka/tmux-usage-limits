---
id: TASK-2
title: bun test の CI workflow を追加する
status: To Do
assignee: []
created_date: '2026-07-13 02:21'
updated_date: '2026-07-13 04:04'
labels:
  - plugin
  - ci
dependencies: []
priority: low
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 目的

このリポジトリ (tmux-usage-limits) の CI は現状 release-please のみで、テストが CI で走らない。公開配布物として、push/PR 時に `bun test` を走らせる workflow を追加する。

## 内容

- `.github/workflows/test.yml` を追加: `oven-sh/setup-bun` → `bun test`(対象テストは再構成後の `src/*.test.ts`、dotfiles TASK-49 参照)
- macOS 前提のプラグインだが、テスト自体は engine/display ロジックの pure なユニットテストなので `ubuntu-latest` で可。tmux 実機が要る検証は CI 対象外(verify ハーネスはローカル用のまま)
- tmux-usage-limits / herdr-usage-limits / herdr-tab-title の3リポジトリ(dotfiles TASK-53 参照)で workflow 内容を同一に揃える

## 制約

- feature branch + `build:` または `ci:` prefix(日本語メッセージ)

## 検証

1. push した branch で Actions が green
2. わざと失敗するテストを一時 push して red になることを確認後、revert
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Actions の test workflow が green
- [ ] #2 fail し得ることを確認済み
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-13 TASK-85 規約メモ: test workflow は .github/workflows/test.yml 1本を追加し、push/pull_request で checkout -> oven-sh/setup-bun -> bun test を ubuntu-latest で実行する。release-please workflow とは分離して維持する。tmux/herdr 実機 verify は CI 対象外。4兄弟(tmux-usage-limits / herdr-usage-limits / herdr-tab-title / cc-statusline-usage-limits)で同じ最小構成に揃える。
<!-- SECTION:NOTES:END -->
