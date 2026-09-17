# P021 — Enforce tenant isolation and runtime database roles

**Firstmate ID:** `pros-021` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Runtime roles cannot read or mutate another tenant's state.

## Ready when

Dependencies accepted on the integration base: [P020](../tasks/P020-migrations.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C3.

## Write ownership

- `packages/database/drizzle/`
- `packages/database/src/security/`
- `packages/database/tests/isolation/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Add reviewed RLS/role migration using the single migration lane; runtime users are not table owners and have no BYPASSRLS.
2. Use validated transaction-local tenant context; define narrow auth pre-session access separately.
3. Restrict worker access away from authentication secrets and prove server/worker role grants.

## Acceptance evidence

- Cross-tenant reads/writes fail using real nonowner connections; untrusted browser context never reaches a trusted SQL transaction.
- Auth can establish a session before a tenant is selected; migration/admin roles do not mask test failures.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
