# P012 — Implement deterministic message checks

**Firstmate ID:** `pros-012` · **Kind:** ship · **Review:** normal · **Profile:** Luna / max / Fast

## Outcome

Only grounded, bounded French drafts can become send candidates.

## Ready when

Dependencies accepted on the integration base: [P007](../tasks/P007-dependency-integration.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [prompt-personalization.md](../../prompt-personalization.md). Contract sections: C1.

## Write ownership

- `packages/domain/src/content-guard/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Validate length, unresolved variables, allowed factual claims/evidence IDs and campaign-specific constraints.
2. Distinguish retryable generation defects from hold/skip decisions; no unbounded regeneration loop.
3. User prompts and prospect content remain data and cannot override system controls.

## Acceptance evidence

- Unsupported claims, prompt-injection fixtures and leaked placeholders fail.
- A neutral grounded draft passes without requiring a prospect hiring signal where the existing ICP rules do not require one.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
