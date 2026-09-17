# P075 — Implement campaign scheduling and bounded account coordination

**Firstmate ID:** `pros-075` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Active campaigns continuously coordinate bounded discovery and prospect lifecycles.

## Ready when

Dependencies accepted on the integration base: [P023](../tasks/P023-campaign-store.md), [P072](../tasks/P072-discovery.md), [P073](../tasks/P073-account-sync.md), [P074](../tasks/P074-sequence.md), [P069](../tasks/P069-outbox-delivery.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C3 C5.

## Write ownership

- `packages/workflows/src/campaign-control/`
- `apps/worker/src/activities/campaign-control/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use durable schedules/stable IDs and a single account/prospect ownership gate before starting sequences.
2. Process activation/pause/reconnect and entitlement events through C5; avoid polling every second per account.
3. Start only eligible remaining steps and cap work/backlog across tenants for fair service.

## Acceptance evidence

- Duplicate starts, reconnects and repeated schedule ticks do not create duplicate active sequences.
- One tenant's large backlog does not starve reply processing or other accounts.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
