# P092 — Evaluate French qualification and writing quality

**Firstmate ID:** `pros-092` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

The chosen prompts/models meet a stated French-domain quality bar.

## Ready when

Dependencies accepted on the integration base: [P071](../tasks/P071-qualification.md), [P070](../tasks/P070-draft-generation.md), [P045](../tasks/P045-style-inference.md), [P043](../tasks/P043-prompt-defaults.md).

External gates: `model-evaluation-access`.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [prompt-personalization.md](../../prompt-personalization.md), [typesafe-ai.md](../../tools/typesafe-ai.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `tests/evaluations/french/`
- `docs/evidence/quality/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use held-out labeled cases covering decisions/recruiters, missing signals, irrelevant roles and unsupported claims.
2. Measure precision and recall plus factuality, style preference adherence and cost; define acceptance thresholds before running.
3. Compare alternative writing models only as an experiment; no silent default change.

## Acceptance evidence

- Publish sample counts, disagreement cases, thresholds and a reproducible versioned evaluation report.
- Zero unsupported factual claims in the release test set; explicitly report that finite tests do not prove universal correctness.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
