# P087 — Implement idempotent historical-data import

**Firstmate ID:** `pros-087` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

An isolated database receives legacy state without restarting past sequences.

## Ready when

Dependencies accepted on the integration base: [P086](../tasks/P086-migration-parser.md), [P022](../tasks/P022-tenant-store.md), [P023](../tasks/P023-campaign-store.md), [P024](../tasks/P024-style-store.md), [P025](../tasks/P025-prospect-store.md), [P026](../tasks/P026-timeline-store.md), [P030](../tasks/P030-reply-stop.md), [P031](../tasks/P031-billing-store.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C3.

## Write ownership

- `tooling/migration/import/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Import mapped tenant records, profiles, styles, history, exclusions and existing billing associations.
2. Apply historical reply/human-ownership state before creating remaining eligible work.
3. Use stable import keys and report unresolved rows; never fabricate provider success or charge subscriptions.

## Acceptance evidence

- Running the same import twice preserves counts and original identifiers.
- Historical replies and completed sequences produce no new outbound action.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
