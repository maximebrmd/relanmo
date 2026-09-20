import { execFileSync } from "node:child_process";

const repository = "maximebrmd/relanmo";
const workflow = "CI";
const apply = process.argv.length === 3 && process.argv[2] === "--apply";
const pullRequestUrls = [
  "https://github.com/maximebrmd/relanmo/pull/18",
  "https://github.com/maximebrmd/relanmo/pull/17",
  "https://github.com/maximebrmd/relanmo/pull/16",
  "https://github.com/maximebrmd/relanmo/pull/15",
  "https://github.com/maximebrmd/relanmo/pull/14",
];

if (process.argv.length > 2 && !apply) {
  throw new Error(
    "Usage: bun tooling/ci/requeue-open-schema-checks.mjs [--apply]"
  );
}

function runGhAxi(args) {
  return execFileSync("gh-axi", args, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function numberFromUrl(pullRequestUrl) {
  const match = new RegExp(
    `^https://github\\.com/${repository.replace("/", "\\/")}/pull/(?<number>\\d+)$`,
    "u"
  ).exec(pullRequestUrl);
  const number = match?.groups?.number;
  if (!number) {
    throw new Error(`Unexpected pull request URL: ${pullRequestUrl}`);
  }
  return number;
}

runGhAxi(["workflow", "view", workflow, "--repo", repository]);

for (const pullRequestUrl of pullRequestUrls) {
  const number = numberFromUrl(pullRequestUrl);
  const stateResponse = runGhAxi([
    "api",
    `repos/${repository}/pulls/${number}`,
    "--jq",
    ".state",
  ]);
  if (!/\bbody:\s*open\b/u.test(stateResponse)) {
    throw new Error(`${pullRequestUrl} is not open: ${stateResponse}`);
  }

  if (!apply) {
    console.info(`Would close and reopen ${pullRequestUrl}`);
    continue;
  }

  console.info(`Closing and reopening ${pullRequestUrl}`);
  runGhAxi(["pr", "close", number, "--repo", repository]);
  try {
    runGhAxi(["pr", "reopen", number, "--repo", repository]);
  } catch (error) {
    console.error(`Reopen failed for ${pullRequestUrl}; retry it immediately.`);
    throw error;
  }
}

if (apply) {
  console.info(
    `Reopened ${pullRequestUrls.length} pull requests; wait for the CI checks to finish.`
  );
} else {
  console.info(
    `Dry run only. Re-run with --apply to requeue ${pullRequestUrls.length} pull-request checks.`
  );
}
