# P085 — Write outage, restore and account-recovery runbooks

**Firstmate ID:** `pros-085` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

Operators can restore service without accidentally restarting outreach.

## Ready when

Dependencies accepted on the integration base: [P082](../tasks/P082-render-config.md), [P084](../tasks/P084-release.md), [P042](../tasks/P042-observability.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `docs/operations/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Document provider outage, delayed webhooks, UNKNOWN sends, account challenge, billing outage and database restore.
2. Explain how to pause outbound independently of inbox ingestion and how to reconcile before resuming.
3. Record alert ownership and redact example logs; keep these docs out of apps/docs.

## Acceptance evidence

- A tabletop exercise traces a send timeout and database restore through explicit steps.
- Recovery never blindly replays external side effects or enables two sending owners.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
