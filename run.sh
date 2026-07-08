#!/bin/sh
can_run_bun() {
  [ -n "$1" ] && [ -x "$1" ] && "$1" --version >/dev/null 2>&1
}

resolve_bun() {
  # herdr は GUI 起動だと mise shims が PATH に無いことがあるため bun を明示解決する
  preferred="$HOME/.local/share/mise/shims/bun"
  if can_run_bun "$preferred"; then
    printf '%s\n' "$preferred"
    return 0
  fi

  fallback="$(command -v bun 2>/dev/null || true)"
  if [ "$fallback" != "$preferred" ] && can_run_bun "$fallback"; then
    printf '%s\n' "$fallback"
    return 0
  fi

  echo "bun not found" >&2
  return 1
}

BUN="$(resolve_bun)" || exit 1
exec "$BUN" display.ts
