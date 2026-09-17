# P030 — Implement the atomic reply and manual-takeover transaction

**Firstmate ID:** `pros-030` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Any recorded incoming message makes the account/prospect pair human-owned immediately.

## Ready when

Dependencies accepted on the integration base: [P021](../tasks/P021-rls.md), [P027](../tasks/P027-ledger-store.md), [P029](../tasks/P029-event-store.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C3.

## Write ownership

- `packages/database/src/repositories/reply-stop/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Lock using C3 order, store/dedupe message and event, mark pair/conversation HUMAN_OWNED, cancel future READY work and enqueue stop/alert events atomically.
2. Attachment-only inbound counts without model classification; unmatched manual outbound also stops automation.
3. Match outgoing bot echoes against durable receipts/attempt evidence; ambiguous echoes hold for reconciliation.

## Acceptance evidence

- A rolled-back transaction leaves neither a partial stop nor a lost inbox event.
- After commit no new IN_FLIGHT authorization can succeed; an already authorized send is explicitly outside that guarantee.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
