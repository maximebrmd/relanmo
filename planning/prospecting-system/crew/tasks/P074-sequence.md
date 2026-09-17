# P074 — Implement the deterministic prospect sequence Workflow

**Firstmate ID:** `pros-074` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

One prospect lifecycle waits, sends bounded steps and ends reliably on stop conditions.

## Ready when

Dependencies accepted on the integration base: [P010](../tasks/P010-cadence.md), [P067](../tasks/P067-dispatch.md), [P070](../tasks/P070-draft-generation.md), [P068](../tasks/P068-reconcile.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C5.

## Write ownership

- `packages/workflows/src/prospect-sequence/`
- `apps/worker/src/activities/prospect-sequence/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use stable IDs, small ID-only inputs, durable acceptance waits/timers and C5 pause/reply/account signals.
2. Run database/provider work in Activities; recheck current state before every step.
3. Stop on reply/manual takeover, suppression, inactive state or sequence exhaustion; do not resume human-owned pairs.

## Acceptance evidence

- Time-skipping tests cover the full DM1–DM5 cadence, delayed Activities and stop signals around timers.
- Replay works across worker restart; Workflow code imports no Node/SDK/database side effects.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
