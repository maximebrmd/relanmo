# P053 — Implement campaign editing, activation and pause

**Firstmate ID:** `pros-053` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

A customer authorizes a bounded sequence once and can pause it immediately.

## Ready when

Dependencies accepted on the integration base: [P048](../tasks/P048-command-auth.md), [P023](../tasks/P023-campaign-store.md), [P010](../tasks/P010-cadence.md), [P009](../tasks/P009-eligibility.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C4.

## Write ownership

- `apps/app/features/campaigns/server/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Validate offer, ICP, exclusions, business hours, quota and DM sequence version.
2. Activation persists the scope/version and requests durable scheduling; pause changes database eligibility immediately.
3. Reject invalid account/billing state; do not require approval of every individual message.

## Acceptance evidence

- Duplicate activation cannot start duplicate sequence ownership.
- Pause wins over a stale timer and editing cannot restart a replied-to prospect.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
