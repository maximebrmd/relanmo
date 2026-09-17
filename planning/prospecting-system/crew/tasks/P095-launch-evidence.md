# P095 — Calibrate costs and assemble the launch decision

**Firstmate ID:** `pros-095` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

The captain receives a measured operating budget and concrete launch evidence.

## Ready when

Dependencies accepted on the integration base: [P094](../tasks/P094-pilot.md), [P032](../tasks/P032-usage-store.md), [P085](../tasks/P085-runbooks.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [cost-estimate.md](../../cost-estimate.md), [implementation-plan.md](../../implementation-plan.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `docs/evidence/launch/`
- `tooling/cost-calibration/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Replace planning allowances with measured TypeSafe/Claude usage, Temporal history/actions, database growth, network and connector accounts.
2. Separate SaaS bills from development-agent credit/API usage; developer labor remains EUR 0.
3. Summarize remaining issues, restore/cutover evidence, release commit and cohort limits; do not publish or expand automatically.

## Acceptance evidence

- At least seven measured days feed a reproducible calculation, with sample size and extrapolation stated.
- Every release-critical gate is passed or explicitly unresolved; the final recommendation links to reviewed evidence.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
