# P061 — Build subscription and billing-status screens

**Firstmate ID:** `pros-061` · **Kind:** ship · **Review:** normal · **Profile:** Luna / max / Fast

## Outcome

Customers can understand their subscription and restore paused outbound access.

## Ready when

Dependencies accepted on the integration base: [P007](../tasks/P007-dependency-integration.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C4.

## Write ownership

- `apps/app/app/(app)/settings/billing/`
- `apps/app/features/billing/ui/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Build C4 fixture-driven active/pending/past-due/canceled billing states and injected actions.
2. Show the consequence for outreach while keeping conversation access available.
3. Use agreed product prices only when configured; no invented commercial price.

## Acceptance evidence

- Pending webhook state is distinct from paid access.
- Error states do not encourage repeated subscription creation.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
