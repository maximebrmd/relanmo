# P001 — Create the next-forge workspace and remove conflicting defaults

**Firstmate ID:** `pros-001` · **Kind:** ship · **Review:** integration · **Profile:** Luna / max / Fast

## Outcome

A clean, pinned next-forge baseline in the existing Relanmo repository exposes the five agreed apps and shared package boundaries.

## Ready when

Dependencies accepted on the integration base: None after repository/Firstmate preflight.

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [next-forge.md](../../tools/next-forge.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `apps/`
- `packages/`
- `package.json`
- `bun.lock`
- `turbo.json`
- `.gitignore`
- `AGENTS.md`
- `planning/`
- `.codex/config.toml`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Preserve the existing Relanmo Git history, README identity, FIRSTMATE.md, .codex/config.toml, root AGENTS.md and planning/prospecting-system including brand assets. Scaffold via a temporary directory if next-forge needs an empty destination, and record its upstream revision.
2. Keep apps/app, web, api, docs and worker; remove Clerk, Prisma and Mintlify integration code before creating neutral shells.
3. Preserve requested stack; inspect scaffold dependencies against next-forge and the agreed inventory. No product routes may claim authentication or send messages yet.

## Acceptance evidence

- Fresh Bun install succeeds and the skeleton apps build without Clerk/Prisma/Mintlify secrets.
- Diff contains scaffold/adaptation only; list generated files separately for review.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
