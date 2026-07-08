#!/bin/sh
# キーバインド用: 既存の limits pane があればフォーカス、なければ開く
# （押すたびに pane が増えるのを防ぐ）
H="${HERDR_BIN_PATH:-herdr}"
pane=$("$H" agent list 2>/dev/null | sed -n 's/.*"agent":"limits"[^}]*"pane_id":"\([^"]*\)".*/\1/p' | head -1)
if [ -n "$pane" ]; then
  exec "$H" plugin pane focus "$pane"
fi
exec "$H" plugin pane open --plugin dotfiles.usage-limits --entrypoint limits
