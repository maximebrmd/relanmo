# P083 — Prepare Wrangler setup for private EU buckets

**Firstmate ID:** `pros-083` · **Kind:** ship · **Review:** normal · **Profile:** Luna / max / Fast

## Outcome

An operator has exact reviewed Wrangler commands for staging/production object storage.

## Ready when

Dependencies accepted on the integration base: [P007](../tasks/P007-dependency-integration.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [wrangler.md](../../tools/wrangler.md), [cloudflare-r2.md](../../tools/cloudflare-r2.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `infra/r2/`
- `wrangler.jsonc`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Prepare create/info/CORS/lifecycle commands with explicit EU jurisdiction and environment-specific names.
2. Separate management login from scoped S3 runtime keys and keep public access disabled.
3. Document verification and cleanup scope; do not execute cloud mutations as part of this code-only task.

## Acceptance evidence

- Config/examples match current Wrangler help and Cloudflare AWS v3 endpoint documentation.
- Runbook verifies bucket jurisdiction, CORS and private access; secrets remain placeholders.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
