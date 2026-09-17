# P069 — Deliver product events to Temporal and notifications

**Firstmate ID:** `pros-069` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Committed starts, pauses, handovers and alerts eventually reach their consumers.

## Ready when

Dependencies accepted on the integration base: [P029](../tasks/P029-event-store.md), [P041](../tasks/P041-email.md), [P042](../tasks/P042-observability.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C3 C5.

## Write ownership

- `apps/worker/src/outbox/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Consume leased events with stable workflow and notification IDs; handle already-started/completed workflow outcomes explicitly.
2. Apply bounded retries, acknowledgement and dead-letter visibility without losing the event.
3. Use C5 signals and official Temporal client; keep inbox and outbound workers independently operable.

## Acceptance evidence

- Crashing between delivery and acknowledgement does not create duplicate sequence ownership.
- Temporal outage leaves database reply-stop effective and queued events recover later.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
