import { spawnSync } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.join(import.meta.dirname, "../..");
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
    entries: await readdir(path.join(repositoryRoot, workspaceGroup), {
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
          path.join(
            repositoryRoot,
            workspaceGroup,
            entry.name,
            generatedDirectory
          )
        )
      )
);

await Promise.all(
  [path.join(repositoryRoot, ".turbo"), ...generatedOutputPaths].map(
    (outputPath) => rm(outputPath, { force: true, recursive: true })
  )
);
console.info("Cleared workspace build and task-cache outputs.");

for (const nextApp of nextApps) {
  run(
    bunExecutable,
    ["x", "--no-install", "next", "typegen"],
    path.join(repositoryRoot, "apps", nextApp)
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
