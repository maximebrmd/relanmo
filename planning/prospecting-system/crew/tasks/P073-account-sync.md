# P073 — Implement acceptance and account-history reconciliation

**Firstmate ID:** `pros-073` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Account state, accepted invitations and missed replies are recovered in bounded batches.

## Ready when

Dependencies accepted on the integration base: [P033](../tasks/P033-unipile-accounts.md), [P035](../tasks/P035-unipile-messages.md), [P030](../tasks/P030-reply-stop.md), [P068](../tasks/P068-reconcile.md), [P051](../tasks/P051-account-commands.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C2 C3 C5.

## Write ownership

- `packages/workflows/src/account-sync/`
- `apps/worker/src/activities/account-sync/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Process queued normalized account-status/acceptance inbox events and reconcile bounded health, acceptance and recent activity through official adapters.
2. Replay recovered messages through the same reply/manual-ownership transaction; reconnect never bypasses it.
3. Use cursors, overlap windows and Continue-As-New/history bounds rather than one enormous workflow.

## Acceptance evidence

- Downtime followed by an attachment-only reply is recovered before new sending.
- Repeated sync preserves dedupe and stale account health cannot trigger a send.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
