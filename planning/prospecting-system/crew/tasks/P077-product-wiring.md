# P077 — Connect completed feature screens to server functions

**Firstmate ID:** `pros-077` · **Kind:** ship · **Review:** integration · **Profile:** Luna / max / Fast

## Outcome

The fixture-built customer screens operate against authorized real services.

## Ready when

Dependencies accepted on the integration base: [P047](../tasks/P047-auth-ui.md), [P049](../tasks/P049-profile-commands.md), [P050](../tasks/P050-profile-ui.md), [P051](../tasks/P051-account-commands.md), [P052](../tasks/P052-account-ui.md), [P053](../tasks/P053-campaign-commands.md), [P054](../tasks/P054-campaign-ui.md), [P055](../tasks/P055-style-commands.md), [P056](../tasks/P056-style-ui.md), [P057](../tasks/P057-pipeline-query.md), [P058](../tasks/P058-pipeline-ui.md), [P059](../tasks/P059-timeline-ui.md), [P026](../tasks/P026-timeline-store.md), [P060](../tasks/P060-billing-commands.md), [P061](../tasks/P061-billing-ui.md), [P062](../tasks/P062-metrics-query.md), [P063](../tasks/P063-metrics-ui.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C4.

## Write ownership

- `apps/app/features/*/bindings.ts`
- `apps/app/components/navigation/feature-registry.ts`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Connect each feature's injected server command/query bindings without changing its business implementation.
2. Enable routes in the feature registry and preserve server/client boundaries.
3. Remove fixture providers from production entrypoints while retaining isolated component fixtures for review.

## Acceptance evidence

- Authenticated navigation reaches each completed feature with real DTOs.
- Production bundles contain no mock provider/tenant shortcuts or server credentials.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
