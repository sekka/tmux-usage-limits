---
id: TASK-6
title: tracked local artifact を除去する
status: To Do
assignee: []
created_date: '2026-07-13 04:04'
labels:
  - plugin
  - chore
dependencies: []
priority: low
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## 目的

公開配布リポジトリに不要なローカル生成物を tracked file から外し、以後混入しない状態にする。

## 対象 gap

- tracked `.DS_Store`
- tracked `.claude/` 配下の local settings / lock file

## 内容

- 実コードと README 本体は変更しない
- `.DS_Store` と `.claude/` 配下の tracked file を削除する
- `.gitignore` が `node_modules/`, `.DS_Store`, `.claude/` を含むことを確認する
- 削除後に `git status` と `rg` でローカル artifact が残っていないことを確認する

## 制約

- feature branch + `chore:` prefix(日本語メッセージ)
- 個人 home や絶対パスを task/README に追加しない
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 tracked `.DS_Store` が0件
- [ ] #2 tracked `.claude/` 配下の local file が0件
- [ ] #3 `.gitignore` が再混入を防ぐ
<!-- AC:END -->
