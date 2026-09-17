# P035 — Implement Unipile invitations, sends and history

**Firstmate ID:** `pros-035` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Outbound side effects return evidence or an explicit uncertain outcome.

## Ready when

Dependencies accepted on the integration base: [P007](../tasks/P007-dependency-integration.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [unipile.md](../../tools/unipile.md), [sdk-policy.md](../../sdk-policy.md). Contract sections: C2.

## Write ownership

- `packages/connectors/src/unipile/messages/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Implement invite-without-note, acceptance read, message send and bounded conversation history through C2.
2. Inspect/disable automatic retries for side effects; distinguish definitive rejection from uncertain network failure.
3. Return provider IDs and request evidence; SDK gaps require a narrow documented typed HTTP fallback.

## Acceptance evidence

- A mocked timeout after dispatch results in UNKNOWN-compatible evidence and no second HTTP send.
- History retains manual outgoing and attachment-only messages; no unverified exactly-once claim.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
