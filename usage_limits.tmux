#!/usr/bin/env bash
set -euo pipefail

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

can_run_bun() {
  [[ -n "${1:-}" && -x "$1" ]] && "$1" --version >/dev/null 2>&1
}

resolve_bun() {
  local preferred="$HOME/.local/share/mise/shims/bun"
  if can_run_bun "$preferred"; then
    printf '%s\n' "$preferred"
    return 0
  fi

  local fallback
  fallback="$(command -v bun 2>/dev/null || true)"
  if [[ $fallback != "$preferred" ]] && can_run_bun "$fallback"; then
    printf '%s\n' "$fallback"
    return 0
  fi

  return 1
}

if [[ "${1:-}" == "status" ]]; then
  BUN="$(resolve_bun)" || exit 0
  exec "$BUN" "$CURRENT_DIR/engine.ts"
fi
