# P064 — Wire durable Unipile webhook ingestion

**Firstmate ID:** `pros-064` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Incoming messages reach the atomic stop transaction before any AI work.

## Ready when

Dependencies accepted on the integration base: [P036](../tasks/P036-unipile-events.md), [P029](../tasks/P029-event-store.md), [P030](../tasks/P030-reply-stop.md), [P051](../tasks/P051-account-commands.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C2 C3.

## Write ownership

- `apps/api/app/webhooks/unipile/`
- `apps/api/src/ingestion/unipile/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Authenticate and map the provider account to a tenant using server-owned records.
2. Persist and apply inbound/manual-takeover events using the atomic reply-stop boundary; queue other normalized events durably.
3. Return success only after the durable result; preserve/retry deduplicated pending work if downstream processing fails.

## Acceptance evidence

- Attachment-only replies stop automation while TypeSafe and Temporal are down.
- Duplicate/out-of-order events, invalid authentication and transient database failures have explicit retry behavior.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
