import type { DuePlan } from "../contracts/due-plan";
import { ContractValidationError } from "../contracts/runtime";
import {
  DEFAULT_SEQUENCE_CLOSURE,
  DEFAULT_SEQUENCE_PLAN,
} from "../contracts/values";
import type {
  BusinessTimeZone,
  BusinessWindowConfiguration,
  DirectMessageStep,
  UtcTimestamp,
} from "../contracts/values";
import { nextPermittedInstant } from "./business-window";
import { addLocalCalendarDays, laterUtcTimestamp } from "./timezone";

type DirectMessageSequenceEntry = Extract<
  (typeof DEFAULT_SEQUENCE_PLAN)[number],
  { step: DirectMessageStep }
>;

function sequenceStepPlan(step: DirectMessageStep): DirectMessageSequenceEntry {
  const found = DEFAULT_SEQUENCE_PLAN.find(
    (entry): entry is DirectMessageSequenceEntry => entry.step === step
  );
  if (!found) {
    throw new ContractValidationError(
      `no sequence plan entry for step ${step}`
    );
  }
  return found;
}

/**
 * `dm1AnchorAt` is the confirmed-acceptance instant when planning DM1 itself,
 * and DM1's actual send instant when planning DM2 through DM5 — both are the
 * fixed reference point the DM1 +2/+5/+9/+14-day targets are measured from.
 */
export type CadenceStepInput = Readonly<{
  step: DirectMessageStep;
  dm1AnchorAt: UtcTimestamp;
  priorActualSendAt: UtcTimestamp | null;
  actualDm5SendAt: UtcTimestamp | null;
  businessWindow: BusinessWindowConfiguration;
}>;

function computeIntendedAt(
  step: DirectMessageStep,
  stepPlan: DirectMessageSequenceEntry,
  dm1AnchorAt: UtcTimestamp,
  priorActualSendAt: UtcTimestamp | null,
  timeZone: BusinessTimeZone
): UtcTimestamp {
  const rawTarget = addLocalCalendarDays(
    dm1AnchorAt,
    stepPlan.targetOffsetFromAcceptanceDays,
    timeZone
  );

  if (stepPlan.minimumGapFromPreviousSendDays === null) {
    if (priorActualSendAt !== null) {
      throw new ContractValidationError(
        "DM1 has no prior direct-message send to gap against"
      );
    }
    return rawTarget;
  }

  if (priorActualSendAt === null) {
    throw new ContractValidationError(
      `${step} requires the actual send time of the previous step`
    );
  }

  const rawMinimumGap = addLocalCalendarDays(
    priorActualSendAt,
    stepPlan.minimumGapFromPreviousSendDays,
    timeZone
  );
  return laterUtcTimestamp(rawTarget, rawMinimumGap);
}

function computeClosureAt(
  dm1AnchorAt: UtcTimestamp,
  actualDm5SendAt: UtcTimestamp | null,
  earliestAt: UtcTimestamp,
  timeZone: BusinessTimeZone
): UtcTimestamp {
  const closureFloor = addLocalCalendarDays(
    dm1AnchorAt,
    DEFAULT_SEQUENCE_CLOSURE.minimumDaysAfterDm1,
    timeZone
  );
  // Closure can never precede the current step's own earliest send
  // opportunity: parseDuePlan rejects a plan where closureAt < earliestAt.
  let closureAt = laterUtcTimestamp(closureFloor, earliestAt);
  if (actualDm5SendAt !== null) {
    const afterDelayedDm5 = addLocalCalendarDays(
      actualDm5SendAt,
      DEFAULT_SEQUENCE_CLOSURE.minimumDaysAfterDelayedDm5,
      timeZone
    );
    closureAt = laterUtcTimestamp(closureAt, afterDelayedDm5);
  }
  return closureAt;
}

/**
 * Pure, deterministic due-plan computation for one DM1–DM5 step. Takes no
 * "now" and performs no I/O: the caller supplies every historical fact, and
 * re-invoking with the same facts always yields the same plan, so replaying
 * late work never compresses several steps into one catch-up burst — only
 * the single requested step is computed, and pause/eligibility are rechecked
 * by the caller at dispatch, not by this function.
 */
export function planDirectMessageDuePlan(input: CadenceStepInput): DuePlan {
  const {
    step,
    dm1AnchorAt,
    priorActualSendAt,
    actualDm5SendAt,
    businessWindow,
  } = input;
  const stepPlan = sequenceStepPlan(step);
  const timeZone = businessWindow.businessTimeZone;

  const intendedAt = computeIntendedAt(
    step,
    stepPlan,
    dm1AnchorAt,
    priorActualSendAt,
    timeZone
  );
  const earliestAt = nextPermittedInstant(intendedAt, businessWindow);
  const closureAt = computeClosureAt(
    dm1AnchorAt,
    actualDm5SendAt,
    earliestAt,
    timeZone
  );

  return {
    businessTimeZone: timeZone,
    businessWindow,
    closureAt,
    earliestAt,
    intendedAt,
    step,
  };
}
