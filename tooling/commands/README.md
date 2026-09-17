# Relanmo toolchain commands

These commands are the source-controlled interface for local and CI checks. Run them from the repository root with the pinned Bun release (`1.4.2`). Node.js 24 LTS (`24.21.0`) remains the Temporal worker runtime and worker-smoke target; the app and API production starts intentionally use Bun. The root `package.json` and the `.bun-version` and `.node-version` files are the version pins; a version manager or an explicit binary path can enforce them on a developer machine.

## Workspace names

The current Bun workspaces are the five application names and the scoped package names below. These are the names accepted by `bun run --filter`.

| Workspace | Path | Role |
| --- | --- | --- |
| `app` | `apps/app` | Customer Next.js application |
| `web` | `apps/web` | Static marketing Next.js application |
| `api` | `apps/api` | Next.js API and webhook surface |
| `docs` | `apps/docs` | Fumadocs static documentation |
| `worker` | `apps/worker` | Node.js worker shell |
| `@relanmo/auth` | `packages/auth` | Authentication boundary |
| `@relanmo/connectors` | `packages/connectors` | Provider connector boundary |
| `@relanmo/database` | `packages/database` | Database boundary |
| `@relanmo/design-system` | `packages/design-system` | Shared React UI |
| `@relanmo/domain` | `packages/domain` | Domain boundary |
| `@relanmo/email` | `packages/email` | Email boundary |
| `@relanmo/next-config` | `packages/next-config` | Shared Next.js configuration |
| `@relanmo/observability` | `packages/observability` | Observability boundary |
| `@relanmo/payments` | `packages/payments` | Payments boundary |
| `@relanmo/prompts` | `packages/prompts` | Prompt boundary |
| `@relanmo/storage` | `packages/storage` | Object-storage boundary |
| `@relanmo/typescript-config` | `packages/typescript-config` | Strict shared compiler configs |
| `@relanmo/workflows` | `packages/workflows` | Workflow boundary |

Examples of executable scoped commands:

```sh
bun run --filter app typecheck
bun run --filter web build
bun run --filter api test
bun run --filter docs build
bun run --filter worker typecheck
bun run --filter @relanmo/domain typecheck
```

## Canonical checks

| Purpose | Command | Behavior |
| --- | --- | --- |
| Frozen install | `bun install --frozen-lockfile` (or `bun run verify:install`) | Checks the committed lockfile across all workspaces without changing it. |
| Lint | `bun run lint` | Runs `ultracite check` with Oxlint and the enabled anti-slop preset once at the root. |
| Format | `bun run format` | Applies Oxfmt through `ultracite fix` locally. |
| Typecheck | `bun run typecheck` | Runs each workspace's strict TypeScript check through Turbo. |
| Fresh typecheck | `bun run typecheck:fresh` | Clears generated outputs, regenerates Next route types, then runs Turbo with `--force`. |
| Builds | `bun run build` | Builds all affected workspace targets through Turbo. |
| Bun app/API smoke | `bun run verify:bun` | Builds and starts `app` and `api` through their exact Bun Next.js start scripts, then probes them locally. |
| Node worker smoke | `bun run verify:node` | Compiles the worker TypeScript entry and executes `dist/index.js` with Node. |
| Baseline tests | `bun run test` | Runs the current workspace test scripts; pass-with-no-tests is intentional until test tasks land. |

`typecheck:fresh` removes only generated `.next/`, `.turbo/`, `dist/` and `out/` directories under `apps/*` and `packages/*`, plus the root `.turbo/` cache. It does not remove dependencies or source files. Next.js route helpers are regenerated in `app`, `web`, `api` and `docs` before TypeScript runs, so a successful check does not depend on stale build artifacts.

The Node smoke uses the repository's TypeScript CLI with `noEmit` overridden for this check and writes the generated worker JavaScript to `apps/worker/dist/`. It then runs that output with Node. Set `RELANMO_BUN_BIN` or `RELANMO_NODE_BIN` to use an explicitly installed binary when the ambient versions differ from the repository pins:

```sh
RELANMO_BUN_BIN=/path/to/bun-1.4.2 \
RELANMO_NODE_BIN=/path/to/node-v24.21.0 \
  bun run verify:node
```

The current worker entry is deliberately a shell; the smoke proves Node can execute compiled TypeScript, not that a live Temporal worker or provider is configured. The test command currently has no test files in the scaffold and does not claim coverage or live integration proof.

App and API production starts use Bun exactly:

```sh
bun run --filter app start
bun run --filter api start
```

Both scripts invoke `bun --bun next start`. The static `web` and `docs` apps use the `serve` CLI for their generated `out/` folders. `verify:bun` builds `app` and `api`, launches those exact Bun entrypoints on temporary localhost ports, probes `/` and `/health`, and shuts them down. Use `RELANMO_BUN_BIN` to make that smoke use an explicitly installed Bun 1.4.2 binary.

The runtime declaration exception is deliberate: every workspace that declares `@types/node` pins it to the latest published Node 24 line, `24.13.5`, even though newer Node-major declarations exist. This keeps strict TypeScript aligned with the Node 24 Temporal worker/runtime boundary. The [Node type metadata](https://registry.npmjs.org/@types%2fnode) and [Node.js release policy](https://nodejs.org/en/about/previous-releases) support the exception.

The docs build remains on `next build --webpack` as established by P001: Fumadocs' generated Turbopack query rules are not accepted by this pinned Next.js baseline. This is an explicit compatibility exception, not a second build toolchain for the other apps.

The Oxlint config keeps three style-only compatibility overrides for the existing scaffold (`func-style`, React function-component style and `sort-keys`) so this provider migration does not become a broad source rewrite. The observability error normalizer has a separate, targeted exception because it is the explicit boundary for unknown thrown values; the remaining correctness and anti-slop rules stay enabled.

## Authored and generated material

Authored source includes the command scripts in this directory, root scripts, the strict configs in `packages/typescript-config/`, the Oxlint/Oxfmt configurations, and the Bun/Node version pins. Generated or cache material includes `node_modules/`, `.turbo/`, each app's `.next/`, static `out/`, worker `dist/`, and Next-generated `next-env.d.ts` files. `bun.lock` is generated by Bun but is committed as the reproducible install artifact.

## Dependency and documentation evidence

P001's direct dependencies were retained after an exact Bun 1.4.2 check. P002 adds the documented Oxc toolchain peers `oxlint` (`1.83.0`) and `oxfmt` (`0.68.0`); Ultracite's anti-slop preset is vendored by Ultracite and is not a standalone npm package. `bun outdated --recursive --no-save --no-summary` is used to verify the pinned direct dependencies.

- [next-forge `llms.txt`](https://www.next-forge.com/llms.txt) documents the Turborepo structure and Bun commands.
- [next-forge installation](https://www.next-forge.com/docs/setup/installation) documents Bun initialization and workspace commands.
- [Ultracite Oxlint provider](https://www.ultracite.ai/docs/provider/oxlint) documents the `ultracite/oxlint/*` and `ultracite/oxfmt` presets, anti-slop option, and generated-output exclusions.
- [Ultracite upstream repository](https://github.com/haydenbleasel/ultracite) documents its current monorepo structure and provider setup.
- [Bun workspaces](https://bun.sh/docs/pm/workspaces) documents workspace names, `workspace:*` dependencies and scoped execution.
- [Bun](https://bun.sh/) identifies `1.4.2` as the current stable release.
- [Node.js releases](https://nodejs.org/en/about/previous-releases) identifies Node 24 as LTS; the [Node 24.21.0 release](https://nodejs.org/en/blog/release/v24.21.0) is the tested patch pin.
- [Next.js TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript) documents `next typegen` as the route-type generation step before `tsc`.
