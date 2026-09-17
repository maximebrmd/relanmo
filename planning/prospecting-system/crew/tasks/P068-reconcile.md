# P068 — Reconcile uncertain sends and expired in-flight attempts

**Firstmate ID:** `pros-068` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Uncertain outcomes are resolved from evidence or held without a resend.

## Ready when

Dependencies accepted on the integration base: [P027](../tasks/P027-ledger-store.md), [P028](../tasks/P028-lease-quota.md), [P035](../tasks/P035-unipile-messages.md), [P030](../tasks/P030-reply-stop.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C2 C3.

## Write ownership

- `apps/worker/src/activities/reconciliation/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Inspect bounded provider history, receipts, action identity and time/body evidence; never use body equality alone as certainty.
2. Reconcile provider echoes and unmatched owner messages through the common ownership path.
3. If evidence is inconclusive retain UNKNOWN and surface an actionable hold; account lease expiry cannot authorize a competing send.

## Acceptance evidence

- A confirmed provider message after local timeout resolves once.
- Duplicate text, incomplete history and late manual sends remain safe and do not authorize blind retry.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
