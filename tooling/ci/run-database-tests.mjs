import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repositoryRoot = path.join(import.meta.dirname, "../..");
const bunExecutable =
  process.env.RELANMO_BUN_BIN ?? process.env.npm_execpath ?? "bun";

if (process.env.CI === "true" && !process.env.DATABASE_TEST_ADMIN_URL) {
  console.error(
    "DATABASE_TEST_ADMIN_URL is required in CI; configure a disposable isolated Postgres service instead of silently skipping database tests."
  );
  process.exit(1);
}

const reportDirectory = await mkdtemp(
  path.join(os.tmpdir(), "relanmo-database-tests-")
);
const reportPath = path.join(reportDirectory, "vitest.json");

try {
  let exitCode = 0;
  const result = spawnSync(
    bunExecutable,
    [
      "x",
      "--no-install",
      "vitest",
      "run",
      "packages/database",
      "packages/auth",
      "--maxWorkers=1",
      "--reporter=default",
      "--reporter=json",
      "--outputFile",
      reportPath,
    ],
    {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
    }
  );

  if (result.error) {
    console.error(`Unable to run database tests: ${result.error.message}`);
    exitCode = 1;
  }
  if (result.status !== 0) {
    exitCode = result.status ?? 1;
  }
  if (result.status === 0) {
    const report = JSON.parse(await readFile(reportPath, "utf-8"));
    const skippedTests =
      report.numPendingTests ??
      report.numSkippedTests ??
      report.testResults
        ?.flatMap((suite) => suite.assertionResults ?? [])
        .filter(
          (test) => test.status === "pending" || test.status === "skipped"
        ).length ??
      0;
    if (skippedTests > 0) {
      console.error(
        `Database tests reported ${skippedTests} skipped tests; CI requires a reachable disposable Postgres service.`
      );
      exitCode = 1;
    }
    if (report.numTotalTests === 0) {
      console.error("Database test discovery returned zero tests.");
      exitCode = 1;
    }
  }

  process.exitCode = exitCode;
} finally {
  await rm(reportDirectory, { force: true, recursive: true });
}
