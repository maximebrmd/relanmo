# P001 bootstrap notes

This note records the generated source and local verification for the initial
Relanmo scaffold. Existing planning and brand files remain unchanged.

## Generated sources

- next-forge was generated on 2026-09-17 with `bun x next-forge@latest init
  --name relanmo --package-manager bun --disable-git`.
- The generated package reports next-forge `6.0.2`; the observed upstream
  `main` revision was `f189de79ceef7c1ef69f61f12e272f99b4cdb699`.
- next-forge guidance was checked in the live
  [llms.txt](https://www.next-forge.com/llms.txt) before adapting the workspace.
- Fumadocs was generated with `create-fumadocs-app` using the static MDX,
  Biome, Orama and Bun template. Its approved package set is pinned to
  `fumadocs-core@16.15.11`, `fumadocs-mdx@15.4.1`, and
  `@fumadocs/base-ui@16.15.11`; see the
  [Fumadocs documentation](https://fumadocs.dev/docs).

## Adaptation decisions

- The existing Relanmo identity, README, Firstmate instructions, planning pack
  and brand bytes were retained.
- Five neutral apps remain: `app`, `web`, `api`, `docs` and `worker`.
- Shared boundaries exist for auth, database, design system, domain, email,
  observability, payments, prompts, storage, connectors, workflows and config.
  Provider SDK integration and published exports remain assigned to P007 and
  later cards.
- Clerk, Prisma, Mintlify and their integration code are absent. No provider
  credentials, auth flow or sending route is configured.
- The docs app uses the webpack build path because the generated Fumadocs
  Turbopack query rules are not accepted by the pinned next-forge Next.js
  `16.1.6` baseline.

## Generated versus authored paths

Generated base output, subsequently adapted for Relanmo, is concentrated in
the next-forge workspace files (`package.json`, `tsconfig.json`, `turbo.json`,
`biome.jsonc`, `apps/app/**`, `apps/web/**`, `apps/api/**`,
`packages/design-system/**` and `packages/typescript-config/**`), the
Fumadocs app (`apps/docs/**`) and the Bun lockfile (`bun.lock`). Authored P001
adaptation adds the neutral worker (`apps/worker/**`), provider/domain package
boundaries (`packages/auth`, `database`, `domain`, `email`, `observability`,
`payments`, `prompts`, `storage`, `connectors`, `workflows`, and
`next-config`), Relanmo copy, and this handoff note. The root AGENTS
maintenance section and `CLAUDE.md` were produced by the required
`fm-ensure-agents-md.sh` pass.

## Local verification

At `2026-09-17T14:30:56Z`, the final verification commands all passed:

- `bun install --frozen-lockfile` — frozen install, no changes.
- `bun run check` — 95 files checked, no fixes.
- `bun run typecheck` — 17 successful tasks.
- `bun run build` — five successful app/worker builds.
- `bun run test` — two successful Vitest tasks; no test files, explicitly
  allowed by `--passWithNoTests`.

All are fixture/local checks; no live provider or customer data is involved.
