# P020 — Integrate the initial Drizzle migrations

**Firstmate ID:** `pros-020` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

One reviewed migration lineage creates the agreed schema.

## Ready when

Dependencies accepted on the integration base: [P013](../tasks/P013-database-pool.md), [P014](../tasks/P014-auth-schema.md), [P015](../tasks/P015-tenant-schema.md), [P016](../tasks/P016-campaign-schema.md), [P017](../tasks/P017-lead-schema.md), [P018](../tasks/P018-ledger-schema.md), [P019](../tasks/P019-billing-schema.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [drizzle.md](../../tools/drizzle.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `packages/database/drizzle/`
- `packages/database/drizzle.config.ts`
- `packages/database/src/schema/`
- `tooling/database/migrate.ts`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. As the sole migration owner, add the listed cross-fragment foreign keys/relations to the now-merged schemas, then generate SQL and journal once from that baseline.
2. Validate direct migration role versus pooled runtime role and document migration commands.
3. Review cross-tenant foreign keys and indexes; do not let each feature generate competing migration histories.

## Acceptance evidence

- Apply to a fresh isolated Postgres database and re-run successfully without duplicate effects.
- Compare generated SQL with schema; authenticate with the generated Better Auth tables in the later auth task.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
