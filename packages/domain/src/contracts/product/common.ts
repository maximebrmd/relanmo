/* oxlint-disable anti-slop/no-unknown-parameters -- Product parsers are untrusted browser/transport boundaries. */

import type {
  AccountId,
  CampaignId,
  ConversationId,
  ProspectId,
  TenantId,
} from "../ids";
import {
  parseAccountId,
  parseCampaignId,
  parseConversationId,
  parseProspectId,
  parseTenantId,
} from "../ids";
import {
  ContractValidationError,
  expectArrayOf,
  expectBoolean,
  expectInteger,
  expectNonEmptyString,
  expectRecord,
  expectString,
  isMember,
  isNull,
  readRequired,
} from "../runtime";

/** IDs in these selectors are untrusted browser values; server code derives authorization separately. */
export type TenantSelector = Readonly<{ tenantId: TenantId }>;
export type AccountSelector = Readonly<
  TenantSelector & { accountId: AccountId }
>;
export type ProspectSelector = Readonly<
  AccountSelector & { prospectId: ProspectId }
>;
export type CampaignSelector = Readonly<
  TenantSelector & { campaignId: CampaignId }
>;
export type ConversationSelector = Readonly<
  AccountSelector & { conversationId: ConversationId }
>;

export const PRODUCT_ERROR_CODES = [
  "UNAUTHORIZED",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "REVISION_CONFLICT",
  "PAUSED",
  "UNAVAILABLE",
  "RATE_LIMITED",
  "UNKNOWN",
] as const;
export type ProductErrorCode = (typeof PRODUCT_ERROR_CODES)[number];

export type RevisionConflict = Readonly<{
  actual: number;
  expected: number;
}>;

/** Errors contain stable safe codes only; provider causes, credentials and raw responses never cross this boundary. */
export type ProductError = Readonly<{
  code: ProductErrorCode;
  field: string | null;
  retryable: boolean;
  revision: RevisionConflict | null;
}>;

const PRODUCT_ERROR_FIELD_PATTERN =
  /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*){0,5}$/u;
const PRODUCT_ERROR_FORBIDDEN_FIELD_PATTERN =
  /(?:^|\.)(?:accessToken|apiKey|cause|credential|password|provider|rawResponse|refreshToken|secret|token)(?:\.|$)/iu;
const PRODUCT_ERROR_FIELD_MAXIMUM = 96;

export type RevisionGuard = Readonly<{ expectedRevision: number }>;

export type ProductCommandSuccess<T> = Readonly<{
  data: T;
  success: true;
}>;

export type ProductCommandFailure = Readonly<{
  error: ProductError;
  success: false;
}>;

export type ProductCommandResult<T> =
  | ProductCommandFailure
  | ProductCommandSuccess<T>;

export const PRODUCT_VIEW_STATUSES = [
  "LOADING",
  "EMPTY",
  "READY",
  "PAUSED",
  "ERROR",
  "UNAUTHORIZED",
] as const;
export type ProductViewStatus = (typeof PRODUCT_VIEW_STATUSES)[number];

export const PRODUCT_PAUSE_REASONS = [
  "ACCOUNT_DISCONNECTED",
  "ACCOUNT_MANUAL_PAUSE",
  "ACCOUNT_RESTRICTED",
  "ACCOUNT_RECONCILIATION",
  "CAMPAIGN_PAUSED",
  "ENTITLEMENT_INACTIVE",
  "HUMAN_HANDOVER",
  "UNKNOWN_SEND",
  "FEATURE_DISABLED",
] as const;
export type ProductPauseReason = (typeof PRODUCT_PAUSE_REASONS)[number];

export type ProductViewState<T> =
  | Readonly<{ data: null; status: "LOADING" }>
  | Readonly<{ data: null; status: "EMPTY" }>
  | Readonly<{ data: T; status: "READY" }>
  | Readonly<{
      data: T | null;
      reason: ProductPauseReason;
      status: "PAUSED";
    }>
  | Readonly<{ data: null; error: ProductError; status: "ERROR" }>
  | Readonly<{
      data: null;
      error: ProductError & { code: "UNAUTHORIZED" };
      status: "UNAUTHORIZED";
    }>;

export type PageRequest = Readonly<{
  cursor: string | null;
  limit: number;
}>;

export type PageInfo = Readonly<{
  cursor: string | null;
  hasMore: boolean;
  nextCursor: string | null;
  totalCount: number | null;
}>;

export type ProductPage<T> = Readonly<{
  items: readonly T[];
  page: PageInfo;
}>;

export function parseTenantSelector(value: unknown): TenantSelector {
  const record = expectRecord(value, "selector");
  return Object.freeze({
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

export function parseAccountSelector(value: unknown): AccountSelector {
  const record = expectRecord(value, "selector");
  return Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

export function parseProspectSelector(value: unknown): ProspectSelector {
  const record = expectRecord(value, "selector");
  return Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    prospectId: parseProspectId(readRequired(record, "prospectId")),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

export function parseCampaignSelector(value: unknown): CampaignSelector {
  const record = expectRecord(value, "selector");
  return Object.freeze({
    campaignId: parseCampaignId(readRequired(record, "campaignId")),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

export function parseConversationSelector(
  value: unknown
): ConversationSelector {
  const record = expectRecord(value, "selector");
  return Object.freeze({
    accountId: parseAccountId(readRequired(record, "accountId")),
    conversationId: parseConversationId(readRequired(record, "conversationId")),
    tenantId: parseTenantId(readRequired(record, "tenantId")),
  });
}

export function parseProductText(
  value: unknown,
  path: string,
  maximum = 2000
): string {
  const parsed = expectString(value, path);
  if (parsed.trim().length === 0) {
    throw new ContractValidationError(`${path} must not be empty`);
  }
  if (parsed.length > maximum) {
    throw new ContractValidationError(`${path} is too long`);
  }
  return parsed;
}

export function parseNullableProductText(
  value: unknown,
  path: string,
  maximum = 2000
): string | null {
  if (isNull(value)) {
    return null;
  }
  return parseProductText(value, path, maximum);
}

export function parseProductStringList(
  value: unknown,
  path: string,
  maximumItems = 20,
  maximumItemLength = 240
): readonly string[] {
  return expectArrayOf(
    value,
    (item, itemPath) => parseProductText(item, itemPath, maximumItemLength),
    path,
    maximumItems
  );
}

export function parseRevision(value: unknown, path = "revision"): number {
  return expectInteger(value, path, 0, 1_000_000_000);
}

export function parseRevisionGuard(value: unknown): RevisionGuard {
  const record = expectRecord(value, "revisionGuard");
  return Object.freeze({
    expectedRevision: parseRevision(
      readRequired(record, "expectedRevision"),
      "expectedRevision"
    ),
  });
}

function parseCursor(value: unknown, path: string): string | null {
  if (isNull(value)) {
    return null;
  }
  const parsed = expectNonEmptyString(value, path);
  if (parsed.length > 256 || /[\s]/u.test(parsed)) {
    throw new ContractValidationError(
      `${path} must be a compact opaque cursor`
    );
  }
  return parsed;
}

export function parsePageRequest(value: unknown): PageRequest {
  const record = expectRecord(value, "page");
  return Object.freeze({
    cursor: parseCursor(readRequired(record, "cursor"), "page.cursor"),
    limit: expectInteger(readRequired(record, "limit"), "page.limit", 1, 50),
  });
}

export function parsePageInfo(value: unknown): PageInfo {
  const record = expectRecord(value, "page");
  const hasMore = expectBoolean(
    readRequired(record, "hasMore"),
    "page.hasMore"
  );
  const nextCursor = parseCursor(
    readRequired(record, "nextCursor"),
    "page.nextCursor"
  );
  if (hasMore && nextCursor === null) {
    throw new ContractValidationError(
      "page.nextCursor is required when page.hasMore is true"
    );
  }
  if (!hasMore && nextCursor !== null) {
    throw new ContractValidationError(
      "page.nextCursor must be null when page.hasMore is false"
    );
  }
  return Object.freeze({
    cursor: parseCursor(readRequired(record, "cursor"), "page.cursor"),
    hasMore,
    nextCursor,
    totalCount: isNull(readRequired(record, "totalCount"))
      ? null
      : expectInteger(readRequired(record, "totalCount"), "page.totalCount", 0),
  });
}

function parseRevisionConflict(value: unknown): RevisionConflict {
  const record = expectRecord(value, "error.revision");
  return Object.freeze({
    actual: parseRevision(
      readRequired(record, "actual"),
      "error.revision.actual"
    ),
    expected: parseRevision(
      readRequired(record, "expected"),
      "error.revision.expected"
    ),
  });
}

export function parseProductError(value: unknown): ProductError {
  const record = expectRecord(value, "error");
  const code = expectString(readRequired(record, "code"), "error.code");
  if (!isMember(code, PRODUCT_ERROR_CODES)) {
    throw new ContractValidationError("error.code is unsupported");
  }
  const revisionValue = readRequired(record, "revision");
  const revision = isNull(revisionValue)
    ? null
    : parseRevisionConflict(revisionValue);
  if (code === "REVISION_CONFLICT" && revision === null) {
    throw new ContractValidationError(
      "REVISION_CONFLICT errors must include revision details"
    );
  }
  if (
    code === "REVISION_CONFLICT" &&
    revision !== null &&
    revision.actual === revision.expected
  ) {
    throw new ContractValidationError(
      "REVISION_CONFLICT revision values must differ"
    );
  }
  if (code !== "REVISION_CONFLICT" && revision !== null) {
    throw new ContractValidationError(
      "only REVISION_CONFLICT errors may include revision details"
    );
  }
  const fieldValue = readRequired(record, "field");
  const field = isNull(fieldValue)
    ? null
    : parseProductText(fieldValue, "error.field", PRODUCT_ERROR_FIELD_MAXIMUM);
  if (
    field !== null &&
    (!PRODUCT_ERROR_FIELD_PATTERN.test(field) ||
      PRODUCT_ERROR_FORBIDDEN_FIELD_PATTERN.test(field))
  ) {
    throw new ContractValidationError(
      "error.field must be a bounded UI field path"
    );
  }
  return Object.freeze({
    code,
    field,
    retryable: expectBoolean(
      readRequired(record, "retryable"),
      "error.retryable"
    ),
    revision,
  });
}

export function parseProductCommandResult<T>(
  value: unknown,
  parseData: (input: unknown) => T
): ProductCommandResult<T> {
  const record = expectRecord(value, "commandResult");
  const success = expectBoolean(
    readRequired(record, "success"),
    "commandResult.success"
  );
  if (success) {
    return Object.freeze({
      data: parseData(readRequired(record, "data")),
      success: true,
    });
  }
  return Object.freeze({
    error: parseProductError(readRequired(record, "error")),
    success: false,
  });
}

export function parseProductViewState<T>(
  value: unknown,
  parseData: (input: unknown) => T
): ProductViewState<T> {
  const record = expectRecord(value, "viewState");
  const status = expectString(
    readRequired(record, "status"),
    "viewState.status"
  );
  if (!isMember(status, PRODUCT_VIEW_STATUSES)) {
    throw new ContractValidationError("viewState.status is unsupported");
  }
  if (status === "LOADING" || status === "EMPTY") {
    if (!isNull(readRequired(record, "data"))) {
      throw new ContractValidationError(
        `${status} view state must have null data`
      );
    }
    return Object.freeze({ data: null, status });
  }
  if (status === "READY") {
    return Object.freeze({
      data: parseData(readRequired(record, "data")),
      status,
    });
  }
  if (status === "PAUSED") {
    const reason = expectString(
      readRequired(record, "reason"),
      "viewState.reason"
    );
    if (!isMember(reason, PRODUCT_PAUSE_REASONS)) {
      throw new ContractValidationError("viewState.reason is unsupported");
    }
    const dataValue = readRequired(record, "data");
    return Object.freeze({
      data: isNull(dataValue) ? null : parseData(dataValue),
      reason,
      status,
    });
  }
  const error = parseProductError(readRequired(record, "error"));
  if (!isNull(readRequired(record, "data"))) {
    throw new ContractValidationError(
      `${status} view state must have null data`
    );
  }
  if (status === "UNAUTHORIZED") {
    if (error.code !== "UNAUTHORIZED") {
      throw new ContractValidationError(
        "UNAUTHORIZED view states require an UNAUTHORIZED error"
      );
    }
    return Object.freeze({
      data: null,
      error: Object.freeze({ ...error, code: "UNAUTHORIZED" as const }),
      status,
    });
  }
  return Object.freeze({ data: null, error, status: "ERROR" });
}

export function parseRelativeReturnPath(value: unknown): string {
  const parsed = parseProductText(value, "returnTo", 256);
  const trustedOrigin = "https://app.relanmo.internal";
  if (
    !parsed.startsWith("/") ||
    parsed.startsWith("//") ||
    parsed.includes("\\") ||
    /%(?:25)*(?:2f|5c)/iu.test(parsed)
  ) {
    throw new ContractValidationError(
      "returnTo must be an internal absolute path"
    );
  }
  let resolved: URL;
  try {
    resolved = new URL(parsed, trustedOrigin);
  } catch {
    throw new ContractValidationError("returnTo must be a valid URL path");
  }
  if (resolved.origin !== trustedOrigin || !resolved.pathname.startsWith("/")) {
    throw new ContractValidationError(
      "returnTo must resolve to the application origin"
    );
  }
  return parsed;
}
