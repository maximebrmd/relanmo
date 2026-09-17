import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const bunExecutable = process.env.RELANMO_BUN_BIN ?? "bun";
const nodeExecutable = process.env.RELANMO_NODE_BIN ?? "node";

const fixtures = [
  {
    imports: [
      ["databaseClientSurface", "@relanmo/database/client"],
      ["tenancyRepositorySurface", "@relanmo/database/repositories/tenancy"],
      ["emailDeliverySurface", "@relanmo/email/delivery"],
      ["r2Surface", "@relanmo/storage/r2"],
      ["workflowClientSurface", "@relanmo/workflows/client"],
    ],
    workspace: "apps/worker",
  },
  {
    imports: [
      ["authServerSurface", "@relanmo/auth/server"],
      ["stripeSurface", "@relanmo/payments/stripe"],
    ],
    workspace: "apps/api",
  },
];

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error) {
    throw new Error(`Unable to run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}:\n${output}`);
  }
  return output;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

await Promise.all(
  fixtures.map(async (fixture) => {
    const workspaceRoot = path.resolve(repositoryRoot, fixture.workspace);
    const fixtureRoot = await mkdtemp(
      path.join(workspaceRoot, ".p007-node-runtime-")
    );
    const fixturePath = path.join(fixtureRoot, "entry.ts");
    const outputRoot = path.join(fixtureRoot, "dist");
    const bindings = fixture.imports
      .map(([name, specifier]) => `import { ${name} } from "${specifier}";`)
      .join("\n");
    const values = fixture.imports.map(([name]) => name).join(", ");

    try {
      await writeFile(
        fixturePath,
        `${bindings}\nconsole.log([${values}].join("|"));\n`,
        "utf-8"
      );
      run(
        bunExecutable,
        [
          "build",
          fixturePath,
          "--outdir",
          outputRoot,
          "--target=node",
          "--format=esm",
        ],
        workspaceRoot
      );
      const output = run(
        nodeExecutable,
        [path.join(outputRoot, "entry.js")],
        workspaceRoot
      );
      assert(
        output.includes("node-portable-server"),
        `${fixture.workspace} portable server imports did not execute the expected runtime markers`
      );
      assert(
        !output.includes("server-only"),
        `${fixture.workspace} portable server imports executed a Next-only server-only module`
      );
      console.log(`Node runtime imports passed: ${fixture.workspace}`);
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true });
    }
  })
);
