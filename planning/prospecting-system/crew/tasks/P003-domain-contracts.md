# P003 — Freeze domain identifiers and state contracts

**Firstmate ID:** `pros-003` · **Kind:** ship · **Review:** integration · **Profile:** Luna / max / Fast

## Outcome

All lanes share tenant, prospect, campaign, action and ownership types.

## Ready when

Dependencies accepted on the integration base: [P002](../tasks/P002-toolchain.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C1 C5.

## Write ownership

- `packages/domain/src/contracts/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Implement the domain contract section of crew/contracts.md with discriminated unions and runtime parsing using existing approved validation tools.
2. Define versioned messages, timestamps, branded IDs, eligibility reasons, action states and C5 Workflow IDs/signals/Activity DTOs.
3. Publish fixtures for incoming attachment-only messages, provider echoes and unknown sends; no business implementation yet.

## Acceptance evidence

- Invalid state/event shapes fail validation; representative valid fixtures compile and parse.
- Contract exports import without database, vendor SDKs or Node-only dependencies.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
