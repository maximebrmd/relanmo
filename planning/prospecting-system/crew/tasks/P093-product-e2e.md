# P093 — Verify the complete customer journey in the browser

**Firstmate ID:** `pros-093` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

A customer can configure the product, see automatic activity and take over on reply.

## Ready when

Dependencies accepted on the integration base: [P077](../tasks/P077-product-wiring.md), [P076](../tasks/P076-worker-wiring.md), [P064](../tasks/P064-unipile-webhook.md), [P065](../tasks/P065-stripe-webhook.md), [P079](../tasks/P079-docs-content.md), [P040](../tasks/P040-storage.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [playwright.md](../../tools/playwright.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `tests/e2e/product/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use Playwright with isolated tenants and deterministic provider fixtures for onboarding through handover.
2. Cover editable defaults, preview/reset, campaign activation/pause, pipeline filters, billing and reconnect.
3. Verify no local Claude installation is needed; check public docs search separately.

## Acceptance evidence

- All key paths work with accessible controls, mobile layout and no browser console errors.
- Reply ingestion remains effective when writer/Temporal services are unavailable.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
