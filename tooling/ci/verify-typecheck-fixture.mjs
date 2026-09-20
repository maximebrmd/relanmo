import { spawnSync } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.join(import.meta.dirname, "../..");
const bunExecutable =
  process.env.RELANMO_BUN_BIN ?? process.env.npm_execpath ?? "bun";
const fixturePath = path.join(
  repositoryRoot,
  "packages/domain/src/__ci_typecheck_failure.ts"
);

try {
  await writeFile(
    fixturePath,
    "const controlledTypecheckFailure: string = 42;\nvoid controlledTypecheckFailure;\n",
    { flag: "wx" }
  );

  const result = spawnSync(bunExecutable, ["run", "typecheck"], {
    cwd: repositoryRoot,
    encoding: "utf-8",
  });

  if (result.error) {
    throw new Error(
      `Unable to run the typecheck fixture: ${result.error.message}`
    );
  }

  if (result.status === 0) {
    throw new Error("The controlled type-error fixture unexpectedly passed.");
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (
    !output.includes("__ci_typecheck_failure.ts") ||
    !output.includes("TS2322")
  ) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(
      "The authoritative typecheck failed without reporting the controlled error."
    );
  }

  console.info(
    "The authoritative typecheck rejected the controlled type error."
  );
} finally {
  await rm(fixturePath, { force: true });
}
