# P002 — Pin Bun, Node, Ultracite and Biome commands

**Firstmate ID:** `pros-002` · **Kind:** ship · **Review:** normal · **Profile:** Luna / max / Fast

## Outcome

Every worktree uses the same install, lint, typecheck and targeted verification commands.

## Ready when

Dependencies accepted on the integration base: [P001](../tasks/P001-bootstrap.md).

External gates: None; use fixtures/local services until live access is explicitly available.

Read [AGENTS.md](../../AGENTS.md), [architecture.md](../../architecture.md), [contracts.md](../contracts.md), [review-checklist.md](../review-checklist.md), [bun.md](../../tools/bun.md), [ultracite.md](../../tools/ultracite.md), [biome.md](../../tools/biome.md). Contract sections: shared stack and ownership rules.

## Write ownership

- `package.json`
- `bun.lock`
- `biome.json`
- `biome.jsonc`
- `turbo.json`
- `.node-version`
- `.bun-version`
- `packages/typescript-config/`
- `tooling/commands/`

Only these paths and adjacent tests inside these directories are in scope. Dependencies, root configuration, package exports, shared contracts, schema exports and migration journals are owned by their named integration tasks. If this task explicitly owns one of those surfaces, its declared write scope is the exception. Do not edit a sibling task's code to get a green build; report the exact missing contract/fix. All paths are relative to the future application repository.

## Build

1. Pin compatible Bun and Node.js 24 releases; use Bun for package management and Node for production.
2. Configure Ultracite with Biome and strict TypeScript, retaining approved next-forge tooling.
3. Publish actual commands and workspace names in tooling/commands/README.md; distinguish generated files from source.

## Acceptance evidence

- Frozen Bun install and lint/typecheck pass on the skeleton.
- Node executes a compiled TypeScript smoke entry; no assumption that Bun can run the Temporal native worker.
- Use the actual scoped commands recorded in `tooling/commands/README.md`. Include command, result and commit in the handoff. Do not invent passing output or count mocked checks as live provider proof.

## Boundaries and handoff

One focused review unit. Aim for roughly 150–400 changed logical lines where practical; generated scaffolds/migrations may be larger and must be labeled. If the behavior no longer fits one review, return a proposed split before expanding ownership. Avoid unrelated formatting or a new abstraction used by only a hypothetical future feature.

Ship tasks: one branch/worktree and one PR, with current-base checks and independent review. Crewmates do not merge. Scout tasks: one evidence report in the path assigned by Firstmate; no fake implementation commit. Missing credentials/authorization is an external gate, not permission to test on arbitrary accounts. Never trigger production sending or deployment from a code task.

Task completion output: behavior delivered; changed paths; commands/evidence; known limits; PR URL and commit for a ship, or report path for a scout; dependency/contract decisions. Leave any blocked acceptance criterion explicit.
