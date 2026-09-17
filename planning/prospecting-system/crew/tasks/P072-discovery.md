# P072 — Implement bounded discovery batch workflows

**Firstmate ID:** `pros-072` · **Kind:** ship · **Review:** normal · **Profile:** Luna / max / Fast

## Outcome

Active campaigns ingest bounded search pages without duplicate prospects.

## Ready when

Dependencies accepted on the integration base: [P034](../tasks/P034-unipile-reads.md), [P025](../tasks/P025-prospect-store.md), [P071](../tasks/P071-qualification.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C2 C3 C5.

## Write ownership

- `packages/workflows/src/discovery/`
- `apps/worker/src/activities/discovery/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use deterministic workflows and Activities for network/database access with explicit cursor/batch limits.
2. Honor account health, discovery budget, tenant ICP/exclusions and suppressed pairs.
3. Persist cursor/progress and usage; stop/retry responsibly on rate limits.

## Acceptance evidence

- Restart at a page boundary does not duplicate a candidate/sequence.
- A failed page resumes from recorded progress without an unbounded loop or full rescan.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
