import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const repositoryRoot = path.join(import.meta.dirname, "../..");
const bunExecutable =
  process.env.RELANMO_BUN_BIN ?? process.env.npm_execpath ?? "bun";
const nextApps = [
  { name: "app", path: "/" },
  { name: "api", path: "/health" },
];

const run = (command, args, cwd = repositoryRoot) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status ?? 1}.`);
  }
};

const getFreePort = async () => {
  const server = createServer();
  const listening = once(server, "listening");
  const failed = once(server, "error");
  server.listen(0, "127.0.0.1");

  const event = await Promise.race([listening, failed]);
  if (event.length > 0) {
    throw event[0];
  }

  const address = server.address();
  if (!address || !address.port) {
    server.close();
    throw new Error("Could not determine a free localhost port.");
  }

  server.close();
  await once(server, "close");
  return address.port;
};

const waitForReady = async (url, child, deadline) => {
  if (child.exitCode !== null) {
    throw new Error(`Bun production process exited before serving ${url}.`);
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

const smoke = async ({ name, path: route }) => {
  const port = await getFreePort();
  const child = spawn(
    bunExecutable,
    [
      "run",
      "--filter",
      name,
      "start",
      "--",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: repositoryRoot,
      stdio: "inherit",
    }
  );

  try {
    await waitForReady(
      `http://127.0.0.1:${port}${route}`,
      child,
      Date.now() + 30_000
    );
    console.info(`Bun app/API smoke passed: ${name}`);
  } finally {
    await stop(child);
  }
};

await Promise.all(nextApps.map(smoke));
