# P088 — Implement cutover checks and the rollback rehearsal

**Firstmate ID:** `pros-088` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

A customer can switch from the old plugin to the cloud with one sending owner.

## Ready when

Dependencies accepted on the integration base: [P087](../tasks/P087-migration-import.md), [P073](../tasks/P073-account-sync.md), [P075](../tasks/P075-scheduler.md), [P085](../tasks/P085-runbooks.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `tooling/migration/cutover/`
- `docs/migration/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Require a recorded old-sender shutdown and cutover time, then reconcile recent activity before activation.
2. Preview remaining eligible steps and require resolved identity/account mappings.
3. Rollback pauses cloud first, exports new receipts/replies and only then permits legacy reactivation.

## Acceptance evidence

- A rehearsal refuses activation while old-sender shutdown is unconfirmed.
- Before/after counts and delayed-reply fixtures preserve history and prevent duplicate ownership.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
