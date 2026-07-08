# ai-usage-limits

Claude Code / Codex usage-limit display, shared by [herdr](https://herdr.dev) and tmux.

A single source of behavior (`engine.ts`) reads Claude Code and Codex credentials from the
standard local files or the macOS keychain, caches the usage API responses with `0600`
permissions, and renders a tmux-formatted status line. Two frontends consume it: a herdr
overlay pane (with an outer-window-title daemon and a sidebar summary) and a tmux
`status-right` command.

## Requirements

- [bun](https://bun.sh) — the scripts run on bun (`#!/usr/bin/env bun`). Without bun on
  `PATH` the display is silently empty.
- macOS — credential lookup falls back to the macOS keychain (`security`).
- [herdr](https://herdr.dev) `>= 0.7.0` for the herdr plugin (not needed for tmux-only use).
- A logged-in Claude Code and/or Codex CLI (credentials are read from their standard files).

## Install (herdr)

```sh
herdr plugin install sekka/ai-usage-limits
herdr plugin action invoke start-title-daemon --plugin dotfiles.usage-limits
```

Pin to a released version with `--ref` (release tags are `vX.Y.Z`, see
[Releasing](#releasing)):

```sh
herdr plugin install sekka/ai-usage-limits --ref v0.1.0
```

For local development, link the working copy instead of installing from GitHub:

```sh
git clone https://github.com/sekka/ai-usage-limits
herdr plugin link ./ai-usage-limits
```

The plugin **ID** is `dotfiles.usage-limits`, which differs from the repository name
(`ai-usage-limits`) — it is kept stable for compatibility with existing key bindings. Every
`herdr plugin ... --plugin <id>` command takes the ID, not the repository name.

## Install (tmux / TPM)

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

- `engine.ts` — the shared core: credentials, cache (fresh / stale / expired plus 429
  backoff), the usage API calls, and the tmux-formatted output. Run directly by
  `usage_limits.tmux status`.
- `display.ts` — the herdr overlay pane. Converts the tmux markup to ANSI, reports a short
  summary to the sidebar agents column, and drives the outer terminal window title.
- `title-daemon.ts` — a paneless daemon that keeps the outer window title updated.
- `run.sh`, `ensure-open.sh`, `ensure-title-daemon.sh`, `open-or-focus.sh` — herdr entry and
  lifecycle helpers (resolve bun, ensure the pane / daemon exist per workspace).

## Tests

```sh
bun test ./engine.test.ts ./display.test.ts
```

## Releasing

Releases are automated by [release-please](https://github.com/googleapis/release-please)
(`.github/workflows/release-please.yml`). The flow is:

1. Land [Conventional Commits](https://www.conventionalcommits.org) on `master` (`feat:`,
   `fix:`, `feat!:` for a breaking change).
2. release-please maintains a "Release PR" that bumps the version in
   `herdr-plugin.toml` and writes `CHANGELOG.md` from the commit messages.
3. Merging that PR is the only manual step — it tags `vX.Y.Z` and publishes the GitHub
   Release automatically.

## License

[MIT](LICENSE) © sekka
