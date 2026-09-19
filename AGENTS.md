# Development requirements for the prospecting system

This file is mirrored at the Relanmo application repository root. The repository is seeded with planning and brand assets; it does not yet contain the application implementation. P001 must preserve this initial history, the planning pack and brand assets while scaffolding next-forge.

## Dependencies

- Before adding a dependency, consult https://www.next-forge.com/llms.txt and the relevant next-forge package, addon or migration documentation. Check current manifests and reuse an existing dependency or shared package first.
- Use a documented next-forge addon when it is necessary and simplifies a concrete feature. Record the reason and documentation source.
- Discuss any new dependency outside next-forge's documented choices and the previously agreed stack with the user, and obtain agreement before installing it or changing manifests. Present the purpose, alternatives, code impact and cost first. Continue unrelated work while waiting.
- Previously approved choices remain approved. Fumadocs, Wrangler and the AWS SDK v3 R2 integration are explicitly requested. Review normal transitive dependencies and required peers with the approved library; do not hide an independently chosen service or library in a scaffold.
- Check current library documentation for exact APIs and compatibility. Pin tested versions with Bun and commit the single `bun.lock`.

## Required stack and layout

Use next-forge, Neon PostgreSQL, Better Auth, Drizzle, Stripe, Ultracite with Oxlint and Oxfmt plus its vendored anti-slop preset, Bun as package manager, and official TypeScript-compatible SDKs where available. Retain Temporal, Unipile and TypeSafe from the agreed architecture. Bun runs the Next.js app/API processes; Node.js 24 runs Temporal workers.

Use `apps/app`, `apps/web`, `apps/api`, `apps/docs` with Fumadocs, and `apps/worker`. Set up R2 buckets through Wrangler; application object operations use the AWS S3 v3 SDK. Do not restore Clerk, Prisma, Supabase or Mintlify defaults over these choices.

## Product invariants

Any incoming prospect message stops automated outreach before model classification. Humans handle replies. Preserve the send ledger, uncertain-send reconciliation, account isolation and bounded sequences.

`packages/prompts` contains our shared defaults and composition code. Customer style settings and edits belong in tenant-scoped Neon records, with version history. Adapt to profile facts automatically while keeping customer writing preferences editable. Profile adaptation does not establish a person's writing style without evidence. Customer prompt edits cannot override reply-stop, account authorization or send-state controls.

## Parallel coding with Firstmate

Use the task cards and shared contracts under `planning/prospecting-system/crew/` after copying this pack into the application repository. Crewmates use Codex CLI with `gpt-5.6-luna`, reasoning `max`, and Fast mode; verify the child session's resolved settings. Do not silently change that requested profile.

One task, isolated worktree and small reviewable PR per implementation crewmate. Dispatch only after prerequisite results are accepted on the integration base and write paths are unclaimed. Independent review precedes merging; a green PR on an old base does not satisfy current-commit checks. Keep the configured captain merge authority.

Assign a single integration owner to manifests, `bun.lock`, shared exports, global configuration and migration journals. Feature crewmates do not edit these or global agent instructions incidentally. Request a focused integration task when a shared change is necessary. Different schema fragments may be developed concurrently; migration generation and application are serialized. `packages/database` has no `test` script yet, so its colocated schema tests (e.g. `src/schema/*.test.ts`) do not run under `bun run test`; run them directly with `bunx vitest run <path>` from `packages/database` until an integration task wires the package into that script.

Continue unrelated fixture-based tasks while a live credential or dependency decision is pending. Record external checks honestly. Coding completion does not authorize production prospecting, paid provisioning, public deployment or customer cutover.

## Product identity

The app is named **Relanmo**; repository and technical slug: `relanmo`. Use the identity guide and supplied logo assets at `planning/prospecting-system/brand/`. The French tagline is « La prospection avance. Vous aussi. ». Use a simple black/white logo, neutral gray interface, light/dark themes and Vercel Geist design principles with existing next-forge typography; do not introduce a new font dependency just for branding. Keep customer copy truthful about bounded sending and human takeover on reply. The current logo masters are PNG; do not label raster wrappers as editable vectors.

This repository is public. Use synthetic fixtures and keep credentials and customer data out of commits.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
