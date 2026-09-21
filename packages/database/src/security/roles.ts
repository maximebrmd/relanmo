export const RUNTIME_DATABASE_ROLES = {
  app: "relanmo_app",
  worker: "relanmo_worker",
} as const;

export type RuntimeDatabaseRole =
  (typeof RUNTIME_DATABASE_ROLES)[keyof typeof RUNTIME_DATABASE_ROLES];

/** Authentication secret tables the worker role must not read or mutate. */
export const AUTH_SECRET_TABLES = [
  "login_account",
  "session",
  "verification",
] as const;
