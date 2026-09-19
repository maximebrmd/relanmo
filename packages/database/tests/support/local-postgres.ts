import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";

export type LocalPostgresAdmin = Readonly<{
  adminUrl: string;
  stop: () => Promise<void>;
}>;

const DOCKER_IMAGE = "postgres:16-alpine";
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_INTERVAL_MS = 250;

let cached: Promise<LocalPostgresAdmin | null> | undefined;

function dockerAvailable(): boolean {
  const result = spawnSync("docker", ["info"], { stdio: "ignore" });
  return result.status === 0;
}

/** Polls until a connection succeeds or the deadline passes; recursive, not looped, so each attempt awaits in isolation. */
async function waitForReady(
  adminUrl: string,
  deadline: number
): Promise<boolean> {
  if (Date.now() >= deadline) {
    return false;
  }
  const client = new Client({ connectionString: adminUrl });
  try {
    await client.connect();
    await client.query("select 1");
    await client.end();
    return true;
  } catch {
    await client.end().catch(() => {
      // Connection never opened; nothing to close.
    });
    await delay(READY_POLL_INTERVAL_MS);
    return waitForReady(adminUrl, deadline);
  }
}

/** Starts a disposable, local-only Postgres container. Never touches a real host. */
async function startDockerPostgres(): Promise<LocalPostgresAdmin | null> {
  if (!dockerAvailable()) {
    return null;
  }

  const containerName = `relanmo-test-pg-${randomUUID().slice(0, 8)}`;
  const password = "relanmo-test";
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--name",
      containerName,
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-p",
      "127.0.0.1::5432",
      DOCKER_IMAGE,
    ],
    { encoding: "utf-8" }
  );
  if (run.status !== 0) {
    return null;
  }

  const portResult = spawnSync("docker", ["port", containerName, "5432/tcp"], {
    encoding: "utf-8",
  });
  const hostPortMatch = /:(?<port>\d+)$/u.exec(portResult.stdout.trim());
  const hostPort = hostPortMatch?.groups?.port;
  if (!hostPort) {
    spawnSync("docker", ["stop", containerName]);
    return null;
  }
  const adminUrl = `postgres://postgres:${password}@127.0.0.1:${hostPort}/postgres`;

  const ready = await waitForReady(adminUrl, Date.now() + READY_TIMEOUT_MS);
  if (!ready) {
    spawnSync("docker", ["stop", containerName]);
    return null;
  }

  return {
    adminUrl,
    stop: () => {
      spawnSync("docker", ["stop", containerName]);
      return Promise.resolve();
    },
  };
}

async function resolveLocalPostgresAdmin(): Promise<LocalPostgresAdmin | null> {
  const envUrl = process.env.DATABASE_TEST_ADMIN_URL;
  if (envUrl) {
    const ready = await waitForReady(envUrl, Date.now() + READY_TIMEOUT_MS);
    return ready ? { adminUrl: envUrl, stop: () => Promise.resolve() } : null;
  }
  return startDockerPostgres();
}

/**
 * A local Postgres admin connection, memoized for this process. Prefers
 * `DATABASE_TEST_ADMIN_URL` (e.g. a CI service container); otherwise starts
 * a disposable Docker container. Resolves to null when neither is
 * available, so callers skip clearly instead of faking success.
 */
export function getLocalPostgresAdmin(): Promise<LocalPostgresAdmin | null> {
  cached ??= resolveLocalPostgresAdmin();
  return cached;
}

/**
 * Stops a Docker-started admin Postgres and clears the memoized handle.
 * Test files that call `getLocalPostgresAdmin` (directly, or transitively
 * through `createIsolatedTestDatabase`) must call this once in their
 * top-level `afterAll` so a disposable container never outlives the run.
 * A no-op when `DATABASE_TEST_ADMIN_URL` supplied an externally managed
 * instance, or when nothing was ever started.
 */
export async function stopLocalPostgresAdmin(): Promise<void> {
  const pending = cached;
  cached = undefined;
  const admin = await pending;
  await admin?.stop();
}
