import type {
  BusinessTimeZone,
  BusinessWindowConfiguration,
  SequenceStep,
  UtcTimestamp,
} from "./values";

export type DuePlan = Readonly<{
  businessTimeZone: BusinessTimeZone;
  businessWindow: BusinessWindowConfiguration;
  closureAt: UtcTimestamp | null;
  earliestAt: UtcTimestamp;
  intendedAt: UtcTimestamp;
  step: SequenceStep;
}>;
