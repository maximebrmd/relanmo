import { spawnSync } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const bunExecutable =
  process.env.RELANMO_BUN_BIN ?? process.env.npm_execpath ?? "bun";
const nextApps = ["app", "web", "api", "docs"];
const generatedDirectories = [".next", ".turbo", "dist", "out"];
const workspaceGroups = ["apps", "packages"];

const run = (command, args, cwd = repositoryRoot) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Unable to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const workspaceEntries = await Promise.all(
  workspaceGroups.map(async (workspaceGroup) => ({
    entries: await readdir(join(repositoryRoot, workspaceGroup), {
      withFileTypes: true,
    }),
    workspaceGroup,
  }))
);
const generatedOutputPaths = workspaceEntries.flatMap(
  ({ entries, workspaceGroup }) =>
    entries
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) =>
        generatedDirectories.map((generatedDirectory) =>
          join(repositoryRoot, workspaceGroup, entry.name, generatedDirectory)
        )
      )
);

await Promise.all(
  [join(repositoryRoot, ".turbo"), ...generatedOutputPaths].map((path) =>
    rm(path, { force: true, recursive: true })
  )
);
console.info("Cleared workspace build and task-cache outputs.");

for (const nextApp of nextApps) {
  run(
    bunExecutable,
    ["x", "--no-install", "next", "typegen"],
    join(repositoryRoot, "apps", nextApp)
  );
}

run(bunExecutable, [
  "x",
  "--no-install",
  "turbo",
  "run",
  "typecheck",
  "--force",
]);
