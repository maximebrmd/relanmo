# P007 — Land the approved dependency and export baseline

**Firstmate ID:** `pros-007` · **Kind:** ship · **Review:** integration · **Profile:** Luna / max / Fast

## Outcome

Feature crewmates can import agreed subpaths without competing over manifests or lockfiles.

## Ready when

Dependencies accepted on the integration base: [P004](../tasks/P004-provider-contracts.md), [P005](../tasks/P005-store-contracts.md), [P006](../tasks/P006-ui-contracts.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [dependency-policy.md](../../dependency-policy.md), [sdk-policy.md](../../sdk-policy.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `package.json`
- `bun.lock`
- `packages/*/package.json`
- `apps/*/package.json`
- `packages/*/tsconfig.json`
- `apps/*/tsconfig.json`
- `packages/*/src/index.ts`
- `packages/domain/src/workflow-safe.ts`
- `apps/app/features/*/bindings.ts`
- `tooling/dependencies/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Consult live next-forge docs and sdk-policy.md; install only packages required by approved tasks and pin compatible releases.
2. Publish package/subpath export map for all planned directories; use module entrypoints that do not import unfinished code. Separate server-only and Workflow-safe surfaces; establish disabled feature-binding stubs per C4.
3. Record version/source/reason and required peers; route any unlisted dependency proposal to the captain before changing manifests.

## Acceptance evidence

- Frozen install, workspace resolution and all contract typechecks pass.
- Temporal packages use one version; manifests contain no unintended auth/database/vendor substitutions.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
