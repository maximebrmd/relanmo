import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repositoryRoot = path.join(import.meta.dirname, "../..");
const bunExecutable =
  process.env.RELANMO_BUN_BIN ?? process.env.npm_execpath ?? "bun";
const fixtureDirectory = await mkdtemp(
  path.join(os.tmpdir(), "relanmo-typecheck-fixture-")
);

try {
  await writeFile(
    path.join(fixtureDirectory, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          target: "ES2022",
        },
        files: ["fixture.ts"],
      },
      null,
      2
    )
  );
  await writeFile(
    path.join(fixtureDirectory, "fixture.ts"),
    "const shouldBeText: string = 42;\nvoid shouldBeText;\n"
  );

  const result = spawnSync(
    bunExecutable,
    [
      "x",
      "--no-install",
      "tsc",
      "--project",
      path.join(fixtureDirectory, "tsconfig.json"),
    ],
    {
      cwd: repositoryRoot,
      stdio: "inherit",
    }
  );

  if (result.error) {
    console.error(
      `Unable to run the typecheck fixture: ${result.error.message}`
    );
    process.exit(1);
  }

  if (result.status === 0) {
    console.error("The controlled type-error fixture unexpectedly passed.");
    process.exit(1);
  }

  console.info("Controlled type-error fixture failed as expected.");
} finally {
  await rm(fixtureDirectory, { force: true, recursive: true });
}
