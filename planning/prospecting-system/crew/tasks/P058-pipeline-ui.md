# P058 — Build the lead pipeline with nuqs filters

**Firstmate ID:** `pros-058` · **Kind:** ship · **Review:** normal · **Profile:** Luna / max / Fast

## Outcome

Customers can find leads and understand why automation is active or stopped.

## Ready when

Dependencies accepted on the integration base: [P007](../tasks/P007-dependency-integration.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [nuqs.md](../../tools/nuqs.md). Contract sections: C4.

## Write ownership

- `apps/app/app/(app)/pipeline/`
- `apps/app/features/pipeline/ui/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use nuqs for typed URL filters and C4 fixture-driven table/detail summaries.
2. Show evidence, stage, next due step and hold reasons without suggesting UNKNOWN means failed.
3. Provide empty/error/loading/pagination and keyboard states.

## Acceptance evidence

- Filters survive refresh and invalid query parameters fall back safely.
- Rows link to the correct conversation and do not expose another tenant through URL state.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
