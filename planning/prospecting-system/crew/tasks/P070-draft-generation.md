# P070 — Generate and persist versioned unsent drafts

**Firstmate ID:** `pros-070` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

An eligible step gets a reproducible grounded draft with current style versions.

## Ready when

Dependencies accepted on the integration base: [P044](../tasks/P044-prompt-composer.md), [P038](../tasks/P038-anthropic.md), [P024](../tasks/P024-style-store.md), [P027](../tasks/P027-ledger-store.md), [P012](../tasks/P012-content-guard.md), [P032](../tasks/P032-usage-store.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C2 C3.

## Write ownership

- `apps/worker/src/activities/drafting/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Load tenant profile, campaign/style/evidence snapshot and compose through the shared prompt package.
2. Bound generation/repair attempts and usage; run deterministic content checks.
3. Persist against expected versions and stable action identity; stale drafts can be regenerated only while READY.

## Acceptance evidence

- A style edit during generation rejects the stale result.
- IN_FLIGHT, UNKNOWN and sent payloads are never overwritten; failed quality holds instead of sending.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
