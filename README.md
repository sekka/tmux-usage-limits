# tmux-usage-limits

Claude Code / Codex usage-limit display for tmux `status-right`.

Example output:

```text
CC5: 61% 1h CCW: 22% 18h40m Fable: 71% 18h40m
```

## Features

- Renders Claude Code and Codex usage limits as a compact tmux status segment.
- Reads standard local CLI credentials and caches usage API responses with `0600` file permissions.
- Keeps stale cache output visible during transient API failures and rate-limit backoff.
- Uses a local tmux plugin entrypoint, so no daemon is required.

## Requirements

- [tmux](https://github.com/tmux/tmux/wiki)
- [bun](https://bun.sh) on `PATH`
- macOS for Keychain fallback through `security`
- A logged-in Claude Code and/or Codex CLI

## Install

Add the plugin with TPM:

```tmux
set -g @plugin 'sekka/tmux-usage-limits'
run '~/.tmux/plugins/tpm/tpm'
```

Then call the installed entrypoint from `status-right`:

```tmux
set -g status-right '#(~/.tmux/plugins/tmux-usage-limits/usage_limits.tmux status 2>/dev/null)'
```

## Usage

Reload tmux after installing the plugin, then let `status-right` run:

```sh
tmux source-file ~/.tmux.conf
```

The entrypoint can also be run directly for a one-shot check:

```sh
~/.tmux/plugins/tmux-usage-limits/usage_limits.tmux status
```

## Configuration

There are currently no public plugin configuration options. Change placement, refresh behavior, and surrounding text through tmux's `status-right` setting.

## Security disclosure

- **This plugin reads Claude Code and Codex credentials from their standard local credential files and may fall back to macOS Keychain lookup.**
- **It sends bearer tokens to Anthropic/OpenAI usage endpoints used by the local CLIs to calculate usage limits.**
- **Some usage API behavior is not a stable public plugin API; response schema or availability may change.**
- **Cache files are stored under the user's cache directory with `0600` permissions when written by the engine.**

## How it works

`usage_limits.tmux` is the tmux plugin entrypoint. `usage_limits.tmux status` resolves bun and runs the TypeScript engine.

`src/engine.ts` handles credentials, cache freshness, usage API calls, stale output, 429 backoff, and tmux-formatted output. Shared usage-limit parsing lives in `src/usage-limits-core.ts`.

## Troubleshooting

- Empty output usually means `bun` is not on `PATH`, credentials are unavailable, or the API request failed before a cache was available.
- Run `usage_limits.tmux status` directly to separate tmux formatting problems from API/cache problems.
- If output stays stale, remove the cache file from the local cache directory and run the status command again.

## Development

Run the unit tests:

```sh
bun test
```

Run the local verification harness:

```sh
./verify/verify.sh
```

Releases are automated by [release-please](https://github.com/googleapis/release-please) through `.github/workflows/release-please.yml`. Land Conventional Commits on `master`; release-please maintains the release PR, changelog, tag, and GitHub Release.

## Uninstall

Remove the TPM plugin line and the `status-right` call from `.tmux.conf`, then reload tmux:

```sh
tmux source-file ~/.tmux.conf
```

Remove the installed plugin directory if TPM does not clean it up:

```sh
rm -rf ~/.tmux/plugins/tmux-usage-limits
```

## License

[MIT](LICENSE) (c) sekka
