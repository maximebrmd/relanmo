# P066 — Implement atomic send authorization

**Firstmate ID:** `pros-066` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

A single transaction authorizes one current eligible action into IN_FLIGHT.

## Ready when

Dependencies accepted on the integration base: [P009](../tasks/P009-eligibility.md), [P010](../tasks/P010-cadence.md), [P023](../tasks/P023-campaign-store.md), [P024](../tasks/P024-style-store.md), [P028](../tasks/P028-lease-quota.md), [P027](../tasks/P027-ledger-store.md), [P030](../tasks/P030-reply-stop.md), [P031](../tasks/P031-billing-store.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C3.

## Write ownership

- `packages/database/src/repositories/send-authorization/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use the common account/pair lock order and current human ownership, campaign, entitlement, draft versions, account health and due window.
2. Reserve quota, verify fencing and commit the exact send attempt atomically.
3. Reject stale READY work; preserve UNKNOWN/IN_FLIGHT decisions and immutable payloads.

## Acceptance evidence

- Two real database transactions racing authorization and reply-stop respect the commit guarantee.
- Concurrent workers cannot authorize the same step twice or exceed account quota.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
