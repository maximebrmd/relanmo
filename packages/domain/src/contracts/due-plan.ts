import type { UtcTimestamp, BusinessTimeZone, SequenceStep } from "./values";

export type DuePlan = Readonly<{
  businessTimeZone: BusinessTimeZone;
  closureAt: UtcTimestamp | null;
  earliestAt: UtcTimestamp;
  intendedAt: UtcTimestamp;
  step: SequenceStep;
}>;
