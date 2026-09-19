export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

export type DatabaseEnv = Readonly<{
  runtimeUrl: string;
  migrationUrl: string;
  poolMax: number;
  poolIdleTimeoutMs: number;
  poolConnectionTimeoutMs: number;
}>;

const DEFAULT_POOL_MAX = 5;
const DEFAULT_POOL_IDLE_TIMEOUT_MS = 10_000;
const DEFAULT_POOL_CONNECTION_TIMEOUT_MS = 5000;

const POOL_MAX_BOUNDS = { maximum: 20, minimum: 1 } as const;
const POOL_IDLE_TIMEOUT_BOUNDS = { maximum: 300_000, minimum: 1000 } as const;
const POOL_CONNECTION_TIMEOUT_BOUNDS = {
  maximum: 60_000,
  minimum: 500,
} as const;

type EnvSource = Readonly<Record<string, string | undefined>>;

function requireValue(source: EnvSource, key: string): string {
  const value = source[key];
  if (value === undefined || value.trim().length === 0) {
    throw new DatabaseConfigError(
      `${key} is required and must be a non-empty PostgreSQL connection string`
    );
  }
  return value;
}

function parseConnectionUrl(value: string, key: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new DatabaseConfigError(`${key} must be a valid connection URL`);
  }
  if (!/^postgres(?:ql)?:$/u.test(parsed.protocol)) {
    throw new DatabaseConfigError(
      `${key} must use the postgres:// or postgresql:// scheme`
    );
  }
  return value;
}

function parseBoundedInteger(
  source: EnvSource,
  key: string,
  fallback: number,
  bounds: Readonly<{ minimum: number; maximum: number }>
): number {
  const raw = source[key];
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const value = Number(raw);
  if (
    !Number.isInteger(value) ||
    value < bounds.minimum ||
    value > bounds.maximum
  ) {
    throw new DatabaseConfigError(
      `${key} must be an integer between ${bounds.minimum} and ${bounds.maximum}`
    );
  }
  return value;
}

/**
 * Validates runtime database configuration eagerly and explicitly. Callers
 * must invoke this themselves; it never runs as an import-time side effect,
 * so portable modules stay importable without a configured environment.
 */
export function parseDatabaseEnv(source: EnvSource = process.env): DatabaseEnv {
  const runtimeUrl = parseConnectionUrl(
    requireValue(source, "DATABASE_URL"),
    "DATABASE_URL"
  );
  const migrationUrl = parseConnectionUrl(
    requireValue(source, "DATABASE_URL_UNPOOLED"),
    "DATABASE_URL_UNPOOLED"
  );
  if (runtimeUrl === migrationUrl) {
    throw new DatabaseConfigError(
      "DATABASE_URL and DATABASE_URL_UNPOOLED must be separate connection strings; runtime traffic must not share the privileged migration connection"
    );
  }

  return Object.freeze({
    migrationUrl,
    poolConnectionTimeoutMs: parseBoundedInteger(
      source,
      "DATABASE_POOL_CONNECTION_TIMEOUT_MS",
      DEFAULT_POOL_CONNECTION_TIMEOUT_MS,
      POOL_CONNECTION_TIMEOUT_BOUNDS
    ),
    poolIdleTimeoutMs: parseBoundedInteger(
      source,
      "DATABASE_POOL_IDLE_TIMEOUT_MS",
      DEFAULT_POOL_IDLE_TIMEOUT_MS,
      POOL_IDLE_TIMEOUT_BOUNDS
    ),
    poolMax: parseBoundedInteger(
      source,
      "DATABASE_POOL_MAX",
      DEFAULT_POOL_MAX,
      POOL_MAX_BOUNDS
    ),
    runtimeUrl,
  });
}
