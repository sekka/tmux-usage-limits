# Repository guide for AI agents

## Definition of done — local review gate (no PR round-trip)

Review happens entirely **locally** before merge; there is no pull-request review cycle. The
human intervenes only at two points: kicking off the work, and the final merge decision.

Before declaring any change ready, run BOTH reviews on the feature branch and address every
**valid** finding (false positives may be skipped, each with a one-line reason — addressing
100% is not required):

1. **Codex peer review** via agmsg — an independent peer read of the diff.
2. **CodeRabbit CLI** — `coderabbit review --base master` (add `--agent` for structured,
   agent-consumable findings; `--type all` covers committed + staged + unstaged).

If either reviewer is unavailable (rate limit), fall back to an independent **`reviewer-judgment`
(Opus)** review so the "independent second read" property is preserved. Do NOT skip the gate.

Only after both pass (or the documented fallback runs) is the change "done". Report
"local review passed", then the human makes the merge decision. On approval: merge the branch
into `master` and push — `release-please` then opens the Release PR.

## Notes

- macOS-only environment: use BSD command flags, no GNU-only options.
- Conventional Commits drive `release-please` (prefixes: feat/fix/docs/chore/…).
