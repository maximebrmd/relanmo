# P079 — Write French onboarding and handover help

**Firstmate ID:** `pros-079` · **Kind:** ship · **Review:** normal · **Profile:** Luna / max / Fast

## Outcome

Customers can connect, configure, edit writing style, pause and recover the product.

## Ready when

Dependencies accepted on the integration base: [P078](../tasks/P078-docs-app.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [fumadocs.md](../../tools/fumadocs.md), [prompt-personalization.md](../../prompt-personalization.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `apps/docs/content/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Write concise help for onboarding, LinkedIn reconnect, campaign scope, DM cadence, editable prompts, billing and human replies.
2. Explain laptop-off operation and business sending hours accurately.
3. Link to product routes and keep limitations actionable without implementation jargon.

## Acceptance evidence

- Links and search terms resolve in the static build.
- Docs promise no automatic replies after handover and no impossible guarantee about already-dispatched sends.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
