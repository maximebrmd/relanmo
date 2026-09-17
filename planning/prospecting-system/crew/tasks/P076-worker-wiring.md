# P076 — Wire worker entry points, registries and health checks

**Firstmate ID:** `pros-076` · **Kind:** ship · **Review:** integration · **Profile:** Luna / max / Fast

## Outcome

Compiled Node processes register the completed workflows and Activities.

## Ready when

Dependencies accepted on the integration base: [P075](../tasks/P075-scheduler.md), [P045](../tasks/P045-style-inference.md), [P042](../tasks/P042-observability.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [nodejs.md](../../tools/nodejs.md), [temporal.md](../../tools/temporal.md). Contract sections: C5.

## Write ownership

- `apps/worker/src/main.ts`
- `apps/worker/src/activities/index.ts`
- `apps/worker/src/health/`
- `packages/workflows/src/index.ts`
- `apps/api/instrumentation.ts`
- `apps/api/app/health/`
- `apps/app/app/api/health/`
- `apps/app/instrumentation.ts`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Wire adapters/repositories through explicit dependency injection; configure task queues, timeouts, concurrency and graceful shutdown.
2. Validate service-specific environment keys and initialize observability without logging secrets.
3. Retain worker version/replay compatibility and independent ingress operation during worker outages.

## Acceptance evidence

- Node.js 24 Linux smoke polls an isolated Temporal task queue and handles shutdown.
- Missing critical credentials fail startup visibly; no production traffic is used.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
