import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const bunExecutable =
  process.env.RELANMO_BUN_BIN ?? process.env.npm_execpath ?? "bun";
const nodeExecutable = process.env.RELANMO_NODE_BIN ?? "node";
const nextApps = [
  { directory: join(repositoryRoot, "apps", "app"), name: "app", path: "/" },
  {
    directory: join(repositoryRoot, "apps", "api"),
    name: "api",
    path: "/health",
  },
];

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

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not determine a free localhost port."));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });

const waitForReady = async (url, child, deadline) => {
  if (child.exitCode !== null) {
    throw new Error(`Production process exited before serving ${url}.`);
  }

  try {
    const response = await fetch(url);
    if (response.ok) {
      return;
    }
  } catch {
    // The server may still be starting; retry until the deadline.
  }

  if (Date.now() >= deadline) {
    throw new Error(`Timed out waiting for ${url}.`);
  }

  await delay(100);
  return waitForReady(url, child, deadline);
};

const stop = async (child) => {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(5000)]);

  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
};

for (const nextApp of nextApps) {
  run(bunExecutable, ["run", "--filter", nextApp.name, "build"]);
}

const smoke = async ({ directory, name, path }) => {
  const port = await getFreePort();
  const child = spawn(
    nodeExecutable,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: directory,
      stdio: "inherit",
    }
  );

  try {
    await waitForReady(
      `http://127.0.0.1:${port}${path}`,
      child,
      Date.now() + 30_000
    );
    console.info(`Node production smoke passed: ${name}`);
  } finally {
    await stop(child);
  }
};

await Promise.all(nextApps.map(smoke));
