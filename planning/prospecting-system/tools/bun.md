# Bun — required package manager

Use Bun to install dependencies and run repository scripts. Production application and Temporal processes use Node.js 24 LTS. The user requested Bun as package manager; this does not require switching every runtime or test runner.

## Repository rules

1. Pin an exact tested Bun release in root `package.json` as `packageManager: "bun@<tested-version>"`, and use that same release in CI and Docker build stages.
2. Declare `apps/*` and `packages/*` workspaces. Use `workspace:*` for internal dependencies.
3. Commit `bun.lock`. Use `bun install --frozen-lockfile` in CI and image builds, and remove obsolete alternative lockfiles after verifying migration.
4. Use root scripts such as `bun run dev`, `bun run build`, `bun run lint` and `bun run typecheck`. These script names are proposed repository contracts, not commands guaranteed to exist in an untouched scaffold.
5. Review dependency lifecycle requirements, especially native Temporal packages. Allow only required, verified installation scripts with Bun's trusted-dependency mechanism. Do not approve every dependency script globally.

[Bun lockfile](https://bun.sh/docs/pm/lockfile), [workspaces](https://bun.sh/docs/pm/workspaces), [lifecycle scripts](https://bun.sh/docs/pm/lifecycle).

## Runtime boundary

Launch compiled workers with `node`, and run Vitest/Temporal tests under the chosen Node version. Do not silently replace those tests with `bun test` or force CLIs onto Bun with `--bun`.

Temporal's SDK relies on Node-specific worker facilities, and its current repository strongly discourages running workers under alternative runtimes. Use a pinned released SDK and verify its own compatibility matrix; a development-branch README alone is not release certification. [Temporal runtime requirements](https://github.com/temporalio/sdk-typescript#requirements).

## Verification and cost

Check a clean Linux install, a frozen install, native worker startup and all root tasks. Bun introduces no hosted subscription; its build time consumes existing CI resources. Customer devices need neither Bun nor Node.
