---
id: TASK-9
title: verify/manifest.json の dotfiles.usage-limits 残骸を除去する
status: Done
assignee: []
created_date: '2026-07-20 11:05'
updated_date: '2026-07-20 14:16'
labels:
  - refactor
dependencies: []
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

2026-07-20 の依存棚卸し調査 (cc-statusline TASK-10) で発見。本リポは TPM プラグインで
plugin id の概念を持たない (`@plugin 'sekka/tmux-usage-limits'` の repo 名が識別子) が、
herdr 由来の verify ハーネスをコピーした際の残骸として `verify/manifest.json:2` に
`"plugin_id": "dotfiles.usage-limits"` が残っている。TPM は読まない不活性値だが、
id リネーム (cc-statusline TASK-9: dotfiles.* → sekka.*) の grep 網に引っかかる
迷い文字列なので、フィールドごと除去するか本リポの実態に合う値へ直す。

あわせて `verify/README.md:46,58` の「dotfiles tmux plugin」参照 (検証手順が dotfiles 側
tmux 設定を指す記述) を、dotfiles 前提でない手順に書き直す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 リポ内 grep で `dotfiles.usage-limits` が 0 hit (backlog/・CHANGELOG・docs/specs の記録文書を除く)
- [x] #2 verify/README.md の手順が dotfiles checkout を前提にしない記述になっている
<!-- AC:END -->
