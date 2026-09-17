import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const workerRoot = join(repositoryRoot, "apps", "worker");
const bunExecutable =
  process.env.RELANMO_BUN_BIN ?? process.env.npm_execpath ?? "bun";
const nodeExecutable = process.env.RELANMO_NODE_BIN ?? "node";

const run = (command, args, cwd) => {
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

run(
  bunExecutable,
  [
    "x",
    "--no-install",
    "tsc",
    "--noEmit",
    "false",
    "--outDir",
    "dist",
    "--rootDir",
    "src",
    "--declaration",
    "false",
    "--declarationMap",
    "false",
  ],
  workerRoot
);

run(nodeExecutable, ["--enable-source-maps", "dist/index.js"], workerRoot);
