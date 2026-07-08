# ai-usage-limits

CC/Codex usage display shared by herdr and tmux.

The single source of behavior is `engine.ts`. It reads Claude Code and Codex credentials from the standard local files or keychain, writes cache files with `0600` permissions, and prints the tmux-formatted status line.

## herdr

```sh
herdr plugin install sekka/ai-usage-limits --ref <sha>
herdr plugin action invoke start-title-daemon --plugin dotfiles.usage-limits
```

The plugin ID is `dotfiles.usage-limits` for compatibility with existing key bindings.

## tmux / TPM

Add the plugin with TPM:

```tmux
set -g @plugin 'sekka/ai-usage-limits'
run '~/.tmux/plugins/tpm/tpm'
```

Then call the installed entrypoint from `status-right`:

```tmux
#(~/.tmux/plugins/ai-usage-limits/usage_limits.tmux status 2>/dev/null)
```

The same `engine.ts` is used by both herdr (`display.ts`) and tmux (`usage_limits.tmux status`).

## Tests

```sh
bun test ./engine.test.ts ./display.test.ts
```
