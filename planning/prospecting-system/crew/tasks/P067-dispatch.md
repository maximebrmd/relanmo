# P067 — Implement the outbound dispatch Activity

**Firstmate ID:** `pros-067` · **Kind:** ship · **Review:** critical · **Profile:** Luna / max / Fast

## Outcome

One authorized attempt invokes the provider once and records its actual outcome.

## Ready when

Dependencies accepted on the integration base: [P066](../tasks/P066-authorization.md), [P035](../tasks/P035-unipile-messages.md), [P042](../tasks/P042-observability.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md). Contract sections: C2 C3.

## Write ownership

- `apps/worker/src/activities/dispatch/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Refresh relevant conversation/account state before authorization and ingest newly discovered activity through the same stop path.
2. Authorize, call the C2 provider once, then persist CONFIRMED/FAILED/UNKNOWN with request evidence.
3. On lost lease, timeout or crash recovery use uncertainty handling; a workflow retry must not repeat the side effect blindly.

## Acceptance evidence

- Timeout after an actual send does not create a second request.
- A reply committed before authorization denies sending; the already-authorized external race is recorded honestly.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
