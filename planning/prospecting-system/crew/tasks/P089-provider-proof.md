# P089 — Prove live provider capabilities on enrolled test accounts

**Firstmate ID:** `pros-089` · **Kind:** scout · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

A redacted capability report confirms the exact APIs the MVP relies on.

## Ready when

Dependencies accepted on the integration base: [P033](../tasks/P033-unipile-accounts.md), [P034](../tasks/P034-unipile-reads.md), [P035](../tasks/P035-unipile-messages.md), [P036](../tasks/P036-unipile-events.md), [P037](../tasks/P037-typesafe.md), [P038](../tasks/P038-anthropic.md), [P039](../tasks/P039-stripe-adapter.md).

External gates: `controlled-provider-access`.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [implementation-plan.md](../../implementation-plan.md), [sdk-policy.md](../../sdk-policy.md). Contract sections: shared stack and ownership rules.

## Write ownership

- No application writes. Use Firstmate's generated scout report path.

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use only named enrolled test accounts and controlled recipients within the supplied authorization; do not contact arbitrary prospects.
2. Verify Unipile connection/search/invite/acceptance/send/inbound/manual messages/reconnect and actual webhook authentication/deduplication behavior.
3. Verify TypeSafe access/schema/French smoke, Claude usage and Stripe test events; record SDK/API versions, limitations and reconciliation evidence.

## Acceptance evidence

- Report each capability as passed, failed or unverified with request IDs/redacted evidence.
- Any missing essential capability becomes an explicit blocker/contract revision, never a mock pass.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
