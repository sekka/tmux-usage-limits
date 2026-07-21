#!/usr/bin/env bash
set -euo pipefail

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_STAMP="$CURRENT_DIR/node_modules/.install-stamp"
INSTALL_LOCK_DIR="$CURRENT_DIR/node_modules/.install-lock"
INSTALL_LOCK_PID_FILE="$INSTALL_LOCK_DIR/pid"
INSTALL_LOCK_STALE_SECONDS=120

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

ensure_dependencies() {
  if [[ ! -f "$CURRENT_DIR/package.json" || ! -f "$CURRENT_DIR/bun.lock" ]]; then
    return 1
  fi

  local lock_checksum
  lock_checksum="$(bun_lock_checksum)" || return 1

  if dependencies_are_current "$lock_checksum"; then
    return 0
  fi

  if ! acquire_install_lock; then
    return 1
  fi

  if dependencies_are_current "$lock_checksum"; then
    release_install_lock
    return 0
  fi

  if "$BUN" install --cwd "$CURRENT_DIR" --frozen-lockfile --silent >/dev/null 2>&1; then
    printf '%s\n' "$lock_checksum" >"$INSTALL_STAMP"
    release_install_lock
    return 0
  fi

  release_install_lock
  return 1
}

bun_lock_checksum() {
  local checksum
  checksum="$(shasum -a 256 "$CURRENT_DIR/bun.lock")" || return 1
  printf '%s\n' "${checksum%% *}"
}

dependencies_are_current() {
  local expected="$1"
  local actual=""
  if [[ -f "$INSTALL_STAMP" ]]; then
    actual="$(<"$INSTALL_STAMP")"
  fi

  [[ -d "$CURRENT_DIR/node_modules/usage-limits-core" && "$actual" == "$expected" ]]
}

acquire_install_lock() {
  if mkdir -p "$CURRENT_DIR/node_modules" 2>/dev/null && mkdir "$INSTALL_LOCK_DIR" 2>/dev/null; then
    if ! printf '%s\n' "$$" >"$INSTALL_LOCK_PID_FILE"; then
      rmdir "$INSTALL_LOCK_DIR" 2>/dev/null || true
      return 1
    fi
    return 0
  fi

  if install_lock_is_stale; then
    release_install_lock
    if mkdir "$INSTALL_LOCK_DIR" 2>/dev/null; then
      if ! printf '%s\n' "$$" >"$INSTALL_LOCK_PID_FILE"; then
        release_install_lock
        return 1
      fi
      return 0
    fi
    return 1
  fi

  return 1
}

release_install_lock() {
  rm -f "$INSTALL_LOCK_PID_FILE" 2>/dev/null || true
  rmdir "$INSTALL_LOCK_DIR" 2>/dev/null || true
}

install_lock_is_stale() {
  if [[ ! -d "$INSTALL_LOCK_DIR" ]]; then
    return 1
  fi

  local lock_pid=""
  if [[ -f "$INSTALL_LOCK_PID_FILE" ]]; then
    lock_pid="$(<"$INSTALL_LOCK_PID_FILE")"
  fi

  if [[ "$lock_pid" =~ ^[0-9]+$ ]]; then
    local kill_error
    kill_error="$(kill -0 "$lock_pid" 2>&1)" && return 1
    case "$kill_error" in
      *"Operation not permitted"* | *"not permitted"*) return 1 ;;
      *) return 0 ;;
    esac
  fi

  local lock_mtime now
  lock_mtime="$(stat -f %m "$INSTALL_LOCK_DIR" 2>/dev/null)" || return 1
  now="$(date +%s)" || return 1

  (( now - lock_mtime >= INSTALL_LOCK_STALE_SECONDS ))
}

if [[ "${1:-}" == "status" ]]; then
  BUN="$(resolve_bun)" || exit 0
  ensure_dependencies || exit 0
  exec "$BUN" "$CURRENT_DIR/src/engine.ts"
fi
