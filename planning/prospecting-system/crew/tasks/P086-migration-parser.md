# P086 — Parse legacy exports into a validated import preview

**Firstmate ID:** `pros-086` · **Kind:** ship · **Review:** normal · **Profile:** Luna / max / Fast

## Outcome

Legacy profiles, templates and pipeline records can be assessed without live writes.

## Ready when

Dependencies accepted on the integration base: [P011](../tasks/P011-identity.md), [P007](../tasks/P007-dependency-integration.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [implementation-plan.md](../../implementation-plan.md). Contract sections: C3.

## Write ownership

- `tooling/migration/parse/`
- `tooling/migration/fixtures/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Use representative redacted exports from the existing product and document source revision/format.
2. Parse profile, offers, prompt edits, original IDs, exclusions, timestamps and message history into C3 import records.
3. Report invalid dates, duplicates and unresolved identities; do not add an unlisted XLSX parser without discussion.

## Acceptance evidence

- Synthetic fixtures preserve IDs and human-replied status; invalid rows are reported without silent defaults.
- Dry-run emits counts and a reversible mapping report with no cloud mutation.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
