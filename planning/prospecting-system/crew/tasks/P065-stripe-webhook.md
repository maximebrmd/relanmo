# P065 — Wire verified Stripe webhooks and entitlement updates

**Firstmate ID:** `pros-065` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Billing changes safely update outbound eligibility.

## Ready when

Dependencies accepted on the integration base: [P039](../tasks/P039-stripe-adapter.md), [P031](../tasks/P031-billing-store.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C2 C3.

## Write ownership

- `apps/api/app/webhooks/stripe/`
- `apps/api/src/ingestion/stripe/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Verify the untouched raw body, resolve billing-to-tenant mappings and persist deduplicated events.
2. Fetch current subscription state for ordering/reconciliation and apply it through the billing repository.
3. Keep reply ingestion and account reconciliation alive when subscription access is removed.

## Acceptance evidence

- Bad signatures, duplicate events, out-of-order cancellation/payment and missing mapping are covered.
- A retry after partial processing converges to the current Stripe state.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
