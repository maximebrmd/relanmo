/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type, anti-slop/no-runtime-typeof -- Unipile payloads and SDK errors are untrusted provider values. */

import { UnsuccessfulRequestError } from "unipile-node-sdk";

import { selectSourceStatus, UNIPILE_SOURCE_STATUSES } from "./health";
import type { UnipilePremiumFeature, UnipileSourceStatus } from "./health";

export type UnipileLinkedInAccountSnapshot = Readonly<{
  premiumFeatures: readonly UnipilePremiumFeature[];
  sourceStatus: UnipileSourceStatus | null;
}>;

export type InspectedProviderError = Readonly<{
  message: string;
  status: number | null;
}>;

export const DEADLINE_EXCEEDED_ERROR_NAME = "DeadlineExceededError";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function readErrorStatus(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (!isRecord(value)) {
    return null;
  }
  const status = value.status ?? value.statusCode ?? value.code;
  if (typeof status === "number" && Number.isFinite(status)) {
    return status;
  }
  if (typeof status === "string" && /^\d{3}$/u.test(status)) {
    return Number(status);
  }
  if ("body" in value) {
    return readErrorStatus(value.body);
  }
  return null;
}

function errorMessageFromBody(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (!isRecord(value)) {
    return "";
  }
  const detail = value.detail ?? value.title ?? value.message;
  return typeof detail === "string" ? detail : "";
}

function parsePremiumFeatures(
  value: unknown
): readonly UnipilePremiumFeature[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const features: UnipilePremiumFeature[] = [];
  for (const feature of value) {
    if (
      feature === "recruiter" ||
      feature === "sales_navigator" ||
      feature === "premium"
    ) {
      features.push(feature);
    }
  }
  return features;
}

export function deadlineExceededError(): Error {
  const error = new Error("provider operation exceeded its deadline");
  error.name = DEADLINE_EXCEEDED_ERROR_NAME;
  return error;
}

export function isDeadlineExceeded(error: Error): boolean {
  return error.name === DEADLINE_EXCEEDED_ERROR_NAME;
}

export function caughtError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error("Unipile request failed");
}

export function inspectProviderError(error: Error): InspectedProviderError {
  if (isDeadlineExceeded(error)) {
    return { message: error.message, status: null };
  }
  if (error instanceof UnsuccessfulRequestError) {
    return {
      message: errorMessageFromBody(error.body) || "Unipile request failed",
      status: readErrorStatus(error.body),
    };
  }
  return { message: error.message, status: readErrorStatus(error) };
}

export function parseLinkedInAccount(
  value: unknown
): UnipileLinkedInAccountSnapshot | null {
  if (!isRecord(value) || value.type !== "LINKEDIN") {
    return null;
  }
  const sources = Array.isArray(value.sources) ? value.sources : [];
  const statuses: UnipileSourceStatus[] = [];
  for (const source of sources) {
    if (!isRecord(source) || typeof source.status !== "string") {
      continue;
    }
    for (const status of UNIPILE_SOURCE_STATUSES) {
      if (status === source.status) {
        statuses.push(status);
      }
    }
  }
  const connectionParams = isRecord(value.connection_params)
    ? value.connection_params.im
    : null;
  const premiumFeatures = isRecord(connectionParams)
    ? parsePremiumFeatures(connectionParams.premiumFeatures)
    : [];
  return {
    premiumFeatures,
    sourceStatus: selectSourceStatus(statuses),
  };
}
