import type { UtcTimestamp } from "../../contracts/values";

/**
 * A local correlation ID is for tracing one application operation. It is not
 * an external idempotency key and must never be used as evidence that a write
 * was deduplicated by a provider.
 */
export type ProviderOperationContext = Readonly<{
  correlationId: string;
  deadlineAt: UtcTimestamp;
}>;

export const PROVIDER_NAMES = [
  "BILLING",
  "EMAIL",
  "LINKEDIN",
  "OBJECT_STORAGE",
  "TYPESAFE",
  "WRITING",
] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export type ModelUsage = Readonly<{
  billedAmountMicros: number | null;
  currency: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}>;

export type ProviderSuccess<Value> = Readonly<{
  correlationId: string;
  ok: true;
  value: Value;
}>;

export type InvalidInputFailure = Readonly<{
  code: "INCONSISTENT_INPUT" | "MALFORMED_INPUT" | "OUT_OF_BOUNDS";
  correlationId: string;
  field: string;
  kind: "INVALID_INPUT";
  message: string;
  ok: false;
}>;

export type DefinitiveRefusalFailure = Readonly<{
  code:
    | "ACCOUNT_NOT_AUTHORIZED"
    | "CAPABILITY_UNAVAILABLE"
    | "CONTENT_REJECTED"
    | "ENTITLEMENT_UNAVAILABLE"
    | "NOT_FOUND"
    | "PROVIDER_POLICY_REJECTED"
    | "RECIPIENT_NOT_ELIGIBLE"
    | "SIGNATURE_INVALID";
  correlationId: string;
  kind: "DEFINITIVE_REFUSAL";
  message: string;
  ok: false;
}>;

export type RetryableReadFailure = Readonly<{
  code:
    | "DEADLINE_EXCEEDED"
    | "RATE_LIMITED"
    | "TEMPORARY_UNAVAILABLE"
    | "UPSTREAM_READ_FAILURE";
  correlationId: string;
  kind: "RETRYABLE_READ_FAILURE";
  message: string;
  ok: false;
  retryAfterAt: UtcTimestamp | null;
}>;

/**
 * This outcome is deliberately write-only. Callers must reconcile before
 * attempting another conflicting write; a timeout is not a retry permission.
 */
export type AmbiguousWriteFailure = Readonly<{
  code: "DEADLINE_EXCEEDED" | "RESPONSE_LOST" | "TRANSPORT_ERROR";
  correlationId: string;
  kind: "AMBIGUOUS_WRITE";
  message: string;
  ok: false;
  reconciliationRequired: true;
}>;

export type UnavailableCredentialsFailure = Readonly<{
  code: "CREDENTIALS_UNAVAILABLE";
  correlationId: string;
  credential: "ACCOUNT" | "APPLICATION" | "SIGNING_SECRET";
  kind: "UNAVAILABLE_CREDENTIALS";
  message: string;
  ok: false;
  provider: ProviderName;
}>;

export type ProviderFailure =
  | AmbiguousWriteFailure
  | DefinitiveRefusalFailure
  | InvalidInputFailure
  | RetryableReadFailure
  | UnavailableCredentialsFailure;

export type ProviderReadFailure =
  | DefinitiveRefusalFailure
  | InvalidInputFailure
  | RetryableReadFailure
  | UnavailableCredentialsFailure;

export type ProviderWriteFailure =
  | AmbiguousWriteFailure
  | DefinitiveRefusalFailure
  | InvalidInputFailure
  | UnavailableCredentialsFailure;

export type ProviderResult<Value> = ProviderFailure | ProviderSuccess<Value>;

export type ProviderReadResult<Value> =
  | ProviderReadFailure
  | ProviderSuccess<Value>;

export type ProviderWriteResult<Value> =
  | ProviderSuccess<Value>
  | ProviderWriteFailure;

export function providerSuccess<Value>(
  context: ProviderOperationContext,
  value: Value
): ProviderSuccess<Value> {
  return Object.freeze({
    correlationId: context.correlationId,
    ok: true as const,
    value,
  });
}

export function providerInvalidInput(
  context: ProviderOperationContext,
  field: string,
  message: string,
  code: InvalidInputFailure["code"] = "MALFORMED_INPUT"
): InvalidInputFailure {
  return Object.freeze({
    code,
    correlationId: context.correlationId,
    field,
    kind: "INVALID_INPUT" as const,
    message,
    ok: false as const,
  });
}

export function providerDefinitiveRefusal(
  context: ProviderOperationContext,
  code: DefinitiveRefusalFailure["code"],
  message: string
): DefinitiveRefusalFailure {
  return Object.freeze({
    code,
    correlationId: context.correlationId,
    kind: "DEFINITIVE_REFUSAL" as const,
    message,
    ok: false as const,
  });
}

export function providerRetryableReadFailure(
  context: ProviderOperationContext,
  code: RetryableReadFailure["code"],
  message: string,
  retryAfterAt: UtcTimestamp | null = null
): RetryableReadFailure {
  return Object.freeze({
    code,
    correlationId: context.correlationId,
    kind: "RETRYABLE_READ_FAILURE" as const,
    message,
    ok: false as const,
    retryAfterAt,
  });
}

export function providerAmbiguousWrite(
  context: ProviderOperationContext,
  code: AmbiguousWriteFailure["code"],
  message: string
): AmbiguousWriteFailure {
  return Object.freeze({
    code,
    correlationId: context.correlationId,
    kind: "AMBIGUOUS_WRITE" as const,
    message,
    ok: false as const,
    reconciliationRequired: true as const,
  });
}

export function providerUnavailableCredentials(
  context: ProviderOperationContext,
  provider: ProviderName,
  credential: UnavailableCredentialsFailure["credential"]
): UnavailableCredentialsFailure {
  return Object.freeze({
    code: "CREDENTIALS_UNAVAILABLE" as const,
    correlationId: context.correlationId,
    credential,
    kind: "UNAVAILABLE_CREDENTIALS" as const,
    message: `${provider.toLowerCase()} credentials are unavailable`,
    ok: false as const,
    provider,
  });
}
