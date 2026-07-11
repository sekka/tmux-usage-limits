# ai-usage-limits

Claude Code / Codex usage-limit display for tmux.

`engine.ts` reads Claude Code and Codex credentials from the standard local files or the
macOS keychain, caches the usage API responses with `0600` permissions, and renders a
tmux-formatted status line for `status-right`.

herdr support moved to [sekka/herdr-usage-limits](https://github.com/sekka/herdr-usage-limits).
Use that plugin for herdr panes, titles, and sidebar integration.

## Requirements

- [bun](https://bun.sh) — the scripts run on bun (`#!/usr/bin/env bun`). Without bun on
  `PATH` the display is silently empty.
- macOS — credential lookup falls back to the macOS keychain (`security`).
- A logged-in Claude Code and/or Codex CLI (credentials are read from their standard files).

## Install

Add the plugin with TPM:

```tmux
set -g @plugin 'sekka/ai-usage-limits'
run '~/.tmux/plugins/tpm/tpm'
```

Then call the installed entrypoint from `status-right`:

```tmux
#(~/.tmux/plugins/ai-usage-limits/usage_limits.tmux status 2>/dev/null)
```

## How it works

- `usage_limits.tmux` — the tmux plugin entrypoint. `usage_limits.tmux status` prints the
  status-right segment.
- `engine.ts` — credentials, cache (fresh / stale / expired plus 429 backoff), usage API
  calls, and tmux-formatted output.

## Tests

```sh
bun test
```

## Releasing

Releases are automated by [release-please](https://github.com/googleapis/release-please)
(`.github/workflows/release-please.yml`). The flow is:

1. Land [Conventional Commits](https://www.conventionalcommits.org) on `master` (`feat:`,
   `fix:`, `feat!:` for a breaking change).
2. release-please maintains a "Release PR" that writes `CHANGELOG.md` from the commit
   messages.
3. Merging that PR is the only manual step — it tags `vX.Y.Z` and publishes the GitHub
   Release automatically.

## License

[MIT](LICENSE) © sekka
