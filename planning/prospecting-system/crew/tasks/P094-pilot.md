# P094 — Run the controlled staging pilot and recovery drills

**Firstmate ID:** `pros-094` · **Kind:** scout · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

A small enrolled cohort proves laptop-off operation across the complete cadence.

## Ready when

Dependencies accepted on the integration base: [P089](../tasks/P089-provider-proof.md), [P090](../tasks/P090-delivery-fault-tests.md), [P091](../tasks/P091-tenant-billing-tests.md), [P092](../tasks/P092-quality-evaluation.md), [P093](../tasks/P093-product-e2e.md), [P088](../tasks/P088-cutover.md), [P084](../tasks/P084-release.md).

External gates: `staging-pilot-authorized`.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: shared stack and ownership rules.

## Write ownership

- No application writes. Use Firstmate's generated scout report path.

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use the approved staging deployment and cohort; record account authorization and spending limits.
2. Observe actual replies, business-window scheduling, reconnect and no dual sender; replay restore/rollback drills.
3. Run through a complete follow-up cycle, not just one successful send; block expansion on essential failures.

## Acceptance evidence

- A standalone report includes timing/receipt evidence, failures, recovery actions and unresolved limits.
- Mock acceptance and seven days of data cannot be substituted for the full lifecycle observation.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
