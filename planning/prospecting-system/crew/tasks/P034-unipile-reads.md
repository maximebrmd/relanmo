# P034 — Implement Unipile people search and profile reads

**Firstmate ID:** `pros-034` · **Kind:** ship · **Review:** normal · **Profile:** Luna / max / Fast

## Outcome

Discovery receives normalized candidate pages with explicit provenance.

## Ready when

Dependencies accepted on the integration base: [P007](../tasks/P007-dependency-integration.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [unipile.md](../../tools/unipile.md). Contract sections: C2.

## Write ownership

- `packages/connectors/src/unipile/discovery/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use official SDK methods verified against the pinned release; bound page size and continuation cursors.
2. Map normal LinkedIn features separately from paid account capabilities.
3. Normalize unsupported/rate-limited responses and capture source/time without inventing missing fields.

## Acceptance evidence

- Fixtures cover empty pages, pagination, missing fields and rate limits.
- A normal account does not silently depend on Sales Navigator or another paid capability.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
