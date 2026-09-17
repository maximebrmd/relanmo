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

## Follow-up tooling correction

On 2026-09-17, the live [Bun release page](https://bun.sh/) and the
[Bun releases](https://github.com/oven-sh/bun/releases) identified Bun
`1.4.2` as the current stable release. The root `packageManager` and the
verification commands now use `bun@1.4.2`.

The latest stable direct dependency set was resolved with
`bun@1.4.2 update --latest --recursive` and a follow-up
`bun@1.4.2 outdated --recursive --no-save --no-summary` reported no remaining
outdated direct dependencies. This updates Next.js to `16.3.5`, React to
`19.3.0`, TypeScript to `7.0.2`, Turbo to `2.10.13`, Ultracite to `7.12.0`,
Biome to `2.5.14`, Vitest to `5.0.1`, Tailwind/PostCSS to `4.3.3`/`8.5.28`,
the React design-system dependencies to their current stable versions, and
keeps the current Fumadocs set because it was not reported as outdated.

Compatibility adaptations required by those releases are limited to the
existing scaffold: Ultracite's documented Biome preset paths are now
`ultracite/biome/*`; TypeScript 7 no longer accepts `baseUrl`, so the local
app and design-system configs rely on their existing `paths`; React Day
Picker 10 uses `month_grid` instead of the removed `table` class key; and the
theme menu uses a stable selection handler. No dependency was held back after
the full checks passed, and no new provider or product dependency was added.

The two applicable Greptile findings were fixed: Fumadocs static search now
uses French language processing, and the design-system chart tooltip renders
numeric zero values. At `2026-09-17T14:52:16Z`, latest-Bun frozen install,
Ultracite check (95 files), Turbo typecheck (17 tasks), Turbo build (5 app and
worker builds), Turbo test (2 pass-with-no-tests tasks), and the Node worker
smoke test all passed. The initial PR remains open for independent review;
there is still no provider provisioning, deployment, prospecting, or customer
data migration.
