# P084 — Implement CI release and serialized migration procedures

**Firstmate ID:** `pros-084` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

A release can migrate once and deploy compatible workers with retained evidence.

## Ready when

Dependencies accepted on the integration base: [P008](../tasks/P008-ci.md), [P082](../tasks/P082-render-config.md), [P021](../tasks/P021-rls.md), [P083](../tasks/P083-r2-setup.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [github-actions.md](../../tools/github-actions.md), [temporal.md](../../tools/temporal.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `.github/workflows/release.yml`
- `tooling/release/`
- `infra/releases/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Add environment-scoped release concurrency, separate migration credentials and explicit deployment controls.
2. Require current-head checks, replay compatibility and migration/rollback instructions.
3. Keep production execution gated to an approved release; no branch may bypass dependency or tenancy checks.

## Acceptance evidence

- Dry-run and staging fixtures show one migration owner and a failed migration blocks deployment.
- A worker version rollback does not erase ledger/outbox data or retry UNKNOWN sends.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
