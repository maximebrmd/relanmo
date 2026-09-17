# P010 — Implement the French business-window cadence

**Firstmate ID:** `pros-010` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

A deterministic planner schedules DM1–DM5 without catch-up bursts.

## Ready when

Dependencies accepted on the integration base: [P007](../tasks/P007-dependency-integration.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C1.

## Write ownership

- `packages/domain/src/cadence/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use Europe/Paris and configurable business windows; DM1 follows confirmed acceptance.
2. Compute +2/+5/+9/+14-day targets from DM1 and preserve the minimum gap from the prior actual send; use existing approved date tools or Intl.
3. Close no-response at max(DM1+21 days, actual DM5+7 days); recheck current pause/eligibility at dispatch.

## Acceptance evidence

- Table-driven cases cover both DST transitions, weekends, late DM4 and a paused campaign.
- Delayed work never emits several immediate follow-ups; all five steps have explicit due/expiry outcomes.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
