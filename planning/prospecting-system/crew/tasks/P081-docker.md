# P081 — Create reproducible app, API and worker images

**Firstmate ID:** `pros-081` · **Kind:** ship · **Review:** normal · **Profile:** Luna / max / Fast

## Outcome

Production processes run reproducibly on Node with pinned Bun installation.

## Ready when

Dependencies accepted on the integration base: [P076](../tasks/P076-worker-wiring.md), [P077](../tasks/P077-product-wiring.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [docker.md](../../tools/docker.md), [nodejs.md](../../tools/nodejs.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `infra/docker/`
- `.dockerignore`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use frozen workspace installs, minimal runtime images and explicit app/API/worker entrypoints.
2. Preserve Temporal native SDK requirements and graceful termination.
3. Keep migration tooling in a separate release command/image surface with no baked-in secrets.

## Acceptance evidence

- Each Linux image boots with isolated test configuration and exposes the expected health check.
- Worker native dependencies load; production image contains no development credentials.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
