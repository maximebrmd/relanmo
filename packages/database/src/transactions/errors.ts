/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- This module is the deliberate boundary that normalizes unknown thrown errors escaping a database transaction. */

import type { PersistenceError } from "@relanmo/domain/ports/persistence";

type PgLikeError = Readonly<{ code?: unknown; message?: unknown }>;

function isPgLikeError(error: unknown): error is PgLikeError {
  return typeof error === "object" && error !== null && "message" in error;
}

function describe(error: unknown): string | null {
  if (isPgLikeError(error) && typeof error.message === "string") {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return null;
}

function sqlState(error: unknown): string | null {
  if (isPgLikeError(error) && typeof error.code === "string") {
    return error.code;
  }
  return null;
}

const CONNECTION_SQLSTATE_CLASS = "08";
const INTEGRITY_SQLSTATES = new Set(["23502", "23503", "23505", "23514"]);
const SERIALIZATION_SQLSTATES = new Set(["40001", "40P01"]);

/**
 * Maps an exception that escaped a transaction (a connection failure, a
 * constraint violation, or an unexpected bug in repository code) onto the
 * shared PersistenceError shape. Deliberate `work` failures never reach
 * this path; only unexpected/thrown errors do.
 */
export function mapUnexpectedError(error: unknown): PersistenceError {
  const detail = describe(error);
  const code = sqlState(error);

  if (code?.startsWith(CONNECTION_SQLSTATE_CLASS)) {
    return { code: "UNAVAILABLE", detail, retryable: true };
  }
  if (code && INTEGRITY_SQLSTATES.has(code)) {
    return { code: "INTEGRITY", detail, retryable: false };
  }
  if (code && SERIALIZATION_SQLSTATES.has(code)) {
    return { code: "RETRYABLE", detail, retryable: true };
  }
  // Unclassified failures default to non-retryable: blind retry cannot be
  // assumed safe for an error this boundary does not recognize.
  return { code: "UNAVAILABLE", detail, retryable: false };
}
