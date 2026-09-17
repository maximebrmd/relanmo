import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const bunExecutable = process.env.RELANMO_BUN_BIN ?? "bun";
const probeDirectory = path.resolve(
  repositoryRoot,
  "apps/app/app/p007-boundary"
);
const probePath = path.join(probeDirectory, "page.tsx");
const nextOutputDirectory = path.resolve(repositoryRoot, "apps/app/.next");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

await mkdir(probeDirectory, { recursive: true });
try {
  await writeFile(
    probePath,
    '"use client";\n\nimport { databaseClientSurface } from "@relanmo/database/client";\n\nexport default function BoundaryProbe() {\n  return <p>{databaseClientSurface}</p>;\n}\n',
    "utf-8"
  );

  const result = spawnSync(bunExecutable, ["run", "--filter", "app", "build"], {
    cwd: repositoryRoot,
    encoding: "utf-8",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert(
    result.status !== 0,
    "Next client boundary build unexpectedly succeeded"
  );
  assert(
    /server-only|Client Component/u.test(output),
    `Next client boundary build failed for an unrelated reason:\n${output}`
  );
  console.log("Next client boundary rejection passed.");
} finally {
  await rm(probeDirectory, { force: true, recursive: true });
  await rm(nextOutputDirectory, { force: true, recursive: true });
}
