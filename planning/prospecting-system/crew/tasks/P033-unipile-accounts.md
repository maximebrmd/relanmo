# P033 — Implement Unipile connection and account status

**Firstmate ID:** `pros-033` · **Kind:** ship · **Review:** normal · **Profile:** Luna / max / Fast

## Outcome

The product can issue hosted connection links and normalize account health.

## Ready when

Dependencies accepted on the integration base: [P007](../tasks/P007-dependency-integration.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [unipile.md](../../tools/unipile.md). Contract sections: C2.

## Write ownership

- `packages/connectors/src/unipile/accounts/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use the official SDK and the C2 port; bind returned accounts to server-authorized tenants.
2. Support reconnect and normalize challenge/restriction/disconnect states without suppressing the need for owner action.
3. Redact credentials; use bounded read retries and typed failures.

## Acceptance evidence

- Fixtures cover successful connection, reconnect, expired flow and restricted account.
- An account cannot be rebound by supplying another tenant ID; live behavior stays unverified until the provider-proof task.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
