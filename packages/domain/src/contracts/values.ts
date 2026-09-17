/* oxlint-disable anti-slop/no-unknown-parameters -- Value parsers are explicit untrusted-input boundaries. */

import type { Brand } from "./ids";
import { ContractValidationError, expectString, isMember } from "./runtime";

export type UtcTimestamp = Brand<string, "UtcTimestamp">;

export const BUSINESS_TIME_ZONE = "Europe/Paris" as const;
export type BusinessTimeZone = typeof BUSINESS_TIME_ZONE;

export const BUSINESS_WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;
export type BusinessWeekday = (typeof BUSINESS_WEEKDAYS)[number];

export type LocalBusinessTime = Brand<string, "LocalBusinessTime">;

export type BusinessWindow = Readonly<{
  closesAt: LocalBusinessTime;
  opensAt: LocalBusinessTime;
  weekday: BusinessWeekday;
}>;

export type BusinessWindowConfiguration = Readonly<{
  businessTimeZone: BusinessTimeZone;
  windows: readonly BusinessWindow[];
}>;

export const BUSINESS_WINDOW_STATUSES = ["OPEN", "CLOSED", "UNKNOWN"] as const;
export type BusinessWindowStatus = (typeof BUSINESS_WINDOW_STATUSES)[number];

export type BusinessWindowEvaluation =
  | Readonly<{
      nextOpenAt: null;
      status: "OPEN";
    }>
  | Readonly<{
      nextOpenAt: UtcTimestamp;
      status: "CLOSED";
    }>
  | Readonly<{
      nextOpenAt: null;
      status: "UNKNOWN";
    }>;

export const SEQUENCE_STEPS = [
  "INVITATION",
  "DM1",
  "DM2",
  "DM3",
  "DM4",
  "DM5",
] as const;

export type SequenceStep = (typeof SEQUENCE_STEPS)[number];
export type DirectMessageStep = Exclude<SequenceStep, "INVITATION">;

export const DIRECT_MESSAGE_STEPS = [
  "DM1",
  "DM2",
  "DM3",
  "DM4",
  "DM5",
] as const;

export const DEFAULT_SEQUENCE_PLAN = [
  {
    minimumGapFromPreviousSendDays: null,
    requiresAcceptance: false,
    step: "INVITATION",
    targetOffsetFromAcceptanceDays: null,
  },
  {
    minimumGapFromPreviousSendDays: null,
    requiresAcceptance: true,
    step: "DM1",
    targetOffsetFromAcceptanceDays: 0,
  },
  {
    minimumGapFromPreviousSendDays: 2,
    requiresAcceptance: true,
    step: "DM2",
    targetOffsetFromAcceptanceDays: 2,
  },
  {
    minimumGapFromPreviousSendDays: 3,
    requiresAcceptance: true,
    step: "DM3",
    targetOffsetFromAcceptanceDays: 5,
  },
  {
    minimumGapFromPreviousSendDays: 4,
    requiresAcceptance: true,
    step: "DM4",
    targetOffsetFromAcceptanceDays: 9,
  },
  {
    minimumGapFromPreviousSendDays: 5,
    requiresAcceptance: true,
    step: "DM5",
    targetOffsetFromAcceptanceDays: 14,
  },
] as const;

export type DefaultSequencePlan = typeof DEFAULT_SEQUENCE_PLAN;

export const DEFAULT_SEQUENCE_CLOSURE = {
  minimumDaysAfterDelayedDm5: 7,
  minimumDaysAfterDm1: 21,
} as const;

function knownLocalBusinessTime(value: string): LocalBusinessTime {
  // SAFETY: These default values are authored canonical local clock times.
  return value as LocalBusinessTime;
}

export const DEFAULT_BUSINESS_WINDOW_CONFIGURATION = {
  businessTimeZone: BUSINESS_TIME_ZONE,
  windows: [
    {
      closesAt: knownLocalBusinessTime("18:00"),
      opensAt: knownLocalBusinessTime("09:00"),
      weekday: "MONDAY",
    },
    {
      closesAt: knownLocalBusinessTime("18:00"),
      opensAt: knownLocalBusinessTime("09:00"),
      weekday: "TUESDAY",
    },
    {
      closesAt: knownLocalBusinessTime("18:00"),
      opensAt: knownLocalBusinessTime("09:00"),
      weekday: "WEDNESDAY",
    },
    {
      closesAt: knownLocalBusinessTime("18:00"),
      opensAt: knownLocalBusinessTime("09:00"),
      weekday: "THURSDAY",
    },
    {
      closesAt: knownLocalBusinessTime("18:00"),
      opensAt: knownLocalBusinessTime("09:00"),
      weekday: "FRIDAY",
    },
  ],
} as const satisfies BusinessWindowConfiguration;

function brandTimestamp(value: string): UtcTimestamp {
  // SAFETY: Canonical ISO validation happens before the UTC timestamp is branded.
  return value as UtcTimestamp;
}

export function parseUtcTimestamp(value: unknown): UtcTimestamp {
  const parsed = expectString(value, "timestamp");
  const canonicalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
  if (!canonicalPattern.test(parsed) || Number.isNaN(Date.parse(parsed))) {
    throw new ContractValidationError(
      "timestamp must be a canonical ISO-8601 instant ending in Z"
    );
  }
  if (new Date(parsed).toISOString() !== parsed) {
    throw new ContractValidationError(
      "timestamp must represent a valid UTC instant"
    );
  }
  return brandTimestamp(parsed);
}

export function parseSequenceStep(value: unknown): SequenceStep {
  const parsed = expectString(value, "step");
  if (!isMember(parsed, SEQUENCE_STEPS)) {
    throw new ContractValidationError(
      `step must be one of ${SEQUENCE_STEPS.join(", ")}`
    );
  }
  return parsed;
}

export function parseDirectMessageStep(value: unknown): DirectMessageStep {
  const parsed = expectString(value, "step");
  if (!isMember(parsed, DIRECT_MESSAGE_STEPS)) {
    throw new ContractValidationError(
      `step must be one of ${DIRECT_MESSAGE_STEPS.join(", ")}`
    );
  }
  return parsed;
}

export function parseBusinessTimeZone(value: unknown): BusinessTimeZone {
  const parsed = expectString(value, "timeZone");
  if (parsed !== BUSINESS_TIME_ZONE) {
    throw new ContractValidationError(`timeZone must be ${BUSINESS_TIME_ZONE}`);
  }
  return parsed;
}

export function parseBusinessWeekday(
  value: unknown,
  path = "weekday"
): BusinessWeekday {
  const parsed = expectString(value, path);
  if (!isMember(parsed, BUSINESS_WEEKDAYS)) {
    throw new ContractValidationError(
      `${path} must be one of ${BUSINESS_WEEKDAYS.join(", ")}`
    );
  }
  return parsed;
}

export function parseLocalBusinessTime(
  value: unknown,
  path = "localTime"
): LocalBusinessTime {
  const parsed = expectString(value, path);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(parsed)) {
    throw new ContractValidationError(`${path} must use HH:mm local time`);
  }
  // SAFETY: The HH:mm pattern is validated immediately before branding.
  return parsed as LocalBusinessTime;
}
