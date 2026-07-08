#!/bin/sh
# workspace.created のたびに limits pane の存在を保証する（サイドバー常時表示の自動起動）
H="${HERDR_BIN_PATH:-herdr}"
"$H" agent list 2>/dev/null | grep -q '"agent":"limits"' && exit 0
exec "$H" plugin pane open --plugin dotfiles.usage-limits --entrypoint limits --placement tab --no-focus
