# Deterministic plugin verification harness

## What this proves

`verify.ts` runs this plugin's real tmux entrypoint (`usage_limits.tmux status`)
against a fixture `$HOME` seeded with known cache-file contents. The
`tmux-status` check is the hard gate for rendered status tokens (`CC5`, `CCW`,
`CCF`, `CX5`, `CXW` — and never the retired `CCS`).

Unit tests exercise individual functions in isolation; this harness catches
what they miss: the entrypoint-chain wiring (`usage_limits.tmux` → `engine.ts`),
cache parsing through the real file-system path
(`$HOME/.claude/data/...`, `$HOME/.codex/cache/...`), and label regressions
(e.g. the CCS→CCF rename) that only show up when the whole chain runs.

No network calls happen during verification: the fixture cache timestamp is
always "now", so `engine.ts`'s freshness check (`fresh` staleness) skips the
fetch path entirely regardless of whether credentials exist.

## How to run

```sh
./verify.sh                # source mode: run checks from this working tree
./verify.sh --installed    # also probe the installed plugin copy (non-fatal)
./verify.sh --self-test    # prove the assertion engine itself isn't a no-op
```

Exit code is 0 iff every non-`best_effort` check in `manifest.json` passes.
`--self-test` is a meta-check: it deliberately runs an assertion that should
fail, and exits non-zero only if the assertion engine misses the seeded mismatch.
`--installed` output is informational only (SKIP/WARN) and never affects the
exit code. In this tmux-only repository it usually SKIPs because there is no
matching entry in the herdr plugin registry.

This tmux-only repository does not declare a herdr `plugin_id`; the
`--installed` path skips herdr registry probing when `manifest.json` omits one.

## Pre-release live verification (リリース前動作確認)

`verify.sh` proves the source tree is correct, but the RUNNING plugin is the
copy used by tmux through TPM and `status-right`. To judge whether a change is
releasable, run the working tree AS the live tmux plugin before merging:

1. **Source gate** — `./verify.sh` passes (deterministic, fixture `$HOME`).
2. **Point TPM at the working tree** — change the tmux plugin setting to the
   local checkout, then reinstall through TPM (`prefix + I`) or reload the
   config with `tmux source-file`. This makes `status-right` evaluate dev code.
   Path examples should use the plugin dir (`~/.tmux/plugins/tmux-usage-limits/...`)
   or a `<plugin-dir>` placeholder.
3. **Refresh the status line** — tmux re-evaluates `status-right` on
   `status-interval`. For an immediate check, run `tmux refresh-client -S` or
   reload the config. There is no long-running pane or daemon to restart.
4. **Human confirms the rendered status** — the release judgment is the
   human's, made by looking at the real `status-right` render, not at test
   output. Cross-check it against the provider's usage page.
5. **Release** — merge to master (release-please opens the Release PR).
6. **Restore the pin** — change the tmux plugin setting back to the merged or
   released ref for `sekka/tmux-usage-limits`, then reinstall through TPM.

Steps 1 and 5 are plugin-agnostic; steps 2, 3, and 6 are tmux-specific, and
step 4's user-visible surface is `status-right`.
