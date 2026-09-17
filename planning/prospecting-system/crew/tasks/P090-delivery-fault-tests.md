# P090 — Verify reply races, crashes and uncertain delivery

**Firstmate ID:** `pros-090` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Fault-injection evidence demonstrates the bot stops and recovers as specified.

## Ready when

Dependencies accepted on the integration base: [P076](../tasks/P076-worker-wiring.md), [P064](../tasks/P064-unipile-webhook.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `tests/integration/delivery/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use real isolated Postgres transactions and controllable provider doubles for worker death, lost leases and crash-after-send.
2. Race reply-stop against send authorization across two workers; include attachment-only inbound, duplicate events and manual echoes.
3. Exercise delayed events, billing/campaign pause, style-version races and ambiguous reconciliation.

## Acceptance evidence

- After durable reply commit no new IN_FLIGHT authorization occurs; already authorized sends are measured separately.
- No blind resend follows UNKNOWN and repeated recovery preserves one action identity.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
