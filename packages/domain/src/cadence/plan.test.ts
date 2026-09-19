import { describe, expect, it } from "vitest";

import { parseDuePlan } from "../contracts/parsers";
import type { DirectMessageStep, UtcTimestamp } from "../contracts/values";
import {
  DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
  parseUtcTimestamp,
} from "../contracts/values";
import { planDirectMessageDuePlan } from "./plan";
import type { CadenceStepInput } from "./plan";

function ts(value: string): UtcTimestamp {
  return parseUtcTimestamp(value);
}

const businessWindow = DEFAULT_BUSINESS_WINDOW_CONFIGURATION;

type Case = Readonly<{
  name: string;
  step: DirectMessageStep;
  dm1AnchorAt: string;
  priorActualSendAt: string | null;
  actualDm5SendAt: string | null;
  expectedIntendedAt: string;
  expectedEarliestAt: string;
  expectedClosureAt: string;
}>;

const cases: readonly Case[] = [
  {
    actualDm5SendAt: null,
    dm1AnchorAt: "2026-09-21T08:00:00.000Z",
    expectedClosureAt: "2026-10-12T08:00:00.000Z",
    expectedEarliestAt: "2026-09-21T08:00:00.000Z",
    expectedIntendedAt: "2026-09-21T08:00:00.000Z",
    name: "DM1 sent within business hours is due immediately at acceptance",
    priorActualSendAt: null,
    step: "DM1",
  },
  {
    actualDm5SendAt: null,
    dm1AnchorAt: "2026-09-18T18:00:00.000Z",
    expectedClosureAt: "2026-10-09T18:00:00.000Z",
    expectedEarliestAt: "2026-09-21T07:00:00.000Z",
    expectedIntendedAt: "2026-09-18T18:00:00.000Z",
    name: "DM1 accepted Friday evening is intended immediately but earliest-permitted Monday morning",
    priorActualSendAt: null,
    step: "DM1",
  },
  {
    // DM1 actual send: Thursday 2026-09-24T07:15Z. DM2 target and minimum
    // gap both land on Saturday 2026-09-26, so the raw target is neither
    // pulled earlier nor later by the gap constraint; only the business
    // window pushes it to the following Monday.
    actualDm5SendAt: null,
    dm1AnchorAt: "2026-09-24T07:15:00.000Z",
    expectedClosureAt: "2026-10-15T07:15:00.000Z",
    expectedEarliestAt: "2026-09-28T07:00:00.000Z",
    expectedIntendedAt: "2026-09-26T07:15:00.000Z",
    name: "DM2 weekend target moves into the next Monday business window",
    priorActualSendAt: "2026-09-24T07:15:00.000Z",
    step: "DM2",
  },
  {
    // DM1 anchor Monday 2026-09-21T07:15Z; actual DM2 sent late on Tuesday
    // 2026-09-29. DM3's target (dm1+5 = Saturday 09-26) is earlier than the
    // minimum 3-day gap from the actual DM2 send (Friday 10-02), so the gap
    // constraint dominates and already lands on a weekday.
    actualDm5SendAt: null,
    dm1AnchorAt: "2026-09-21T07:15:00.000Z",
    expectedClosureAt: "2026-10-12T07:15:00.000Z",
    expectedEarliestAt: "2026-10-02T07:15:00.000Z",
    expectedIntendedAt: "2026-10-02T07:15:00.000Z",
    name: "minimum gap from a late actual DM2 send dominates DM3's target date",
    priorActualSendAt: "2026-09-29T07:15:00.000Z",
    step: "DM3",
  },
  {
    // DM1 anchor Monday 2026-09-21T07:15Z; actual DM4 sent very late on
    // Monday 2026-10-12. DM5's target (dm1+14 = Monday 10-05) is far earlier
    // than the minimum 5-day gap from that late DM4 send (Saturday 10-17),
    // so the gap dominates and is then moved off the weekend into Monday.
    // That earliest opportunity (10-19) now falls past the DM1+21 floor
    // (10-12), so closure floors against it rather than preceding it.
    actualDm5SendAt: null,
    dm1AnchorAt: "2026-09-21T07:15:00.000Z",
    expectedClosureAt: "2026-10-19T07:00:00.000Z",
    expectedEarliestAt: "2026-10-19T07:00:00.000Z",
    expectedIntendedAt: "2026-10-17T07:15:00.000Z",
    name: "a late actual DM4 send pushes DM5's minimum gap past its target and off a weekend",
    priorActualSendAt: "2026-10-12T07:15:00.000Z",
    step: "DM5",
  },
  {
    // Same DM1 anchor and actual DM4 send as above, but this time DM5 has
    // already actually been sent late (2026-10-20), so closure compares the
    // DM1+21 floor against the actual-DM5+7 deadline, crossing the autumn
    // DST transition (2026-10-25) along the way. The delayed-DM5 deadline
    // wins.
    actualDm5SendAt: "2026-10-20T07:15:00.000Z",
    dm1AnchorAt: "2026-09-21T07:15:00.000Z",
    expectedClosureAt: "2026-10-27T08:15:00.000Z",
    expectedEarliestAt: "2026-10-19T07:00:00.000Z",
    expectedIntendedAt: "2026-10-17T07:15:00.000Z",
    name: "closure extends seven days past a delayed actual DM5 send beyond the DM1+21 floor",
    priorActualSendAt: "2026-10-12T07:15:00.000Z",
    step: "DM5",
  },
];

describe("planDirectMessageDuePlan", () => {
  it.each(cases)(
    "$name",
    ({
      step,
      dm1AnchorAt,
      priorActualSendAt,
      actualDm5SendAt,
      expectedIntendedAt,
      expectedEarliestAt,
      expectedClosureAt,
    }) => {
      const input: CadenceStepInput = {
        actualDm5SendAt: actualDm5SendAt === null ? null : ts(actualDm5SendAt),
        businessWindow,
        dm1AnchorAt: ts(dm1AnchorAt),
        priorActualSendAt:
          priorActualSendAt === null ? null : ts(priorActualSendAt),
        step,
      };

      const plan = planDirectMessageDuePlan(input);

      expect(plan.step).toBe(step);
      expect(plan.businessTimeZone).toBe("Europe/Paris");
      expect(plan.businessWindow).toBe(businessWindow);
      expect(plan.intendedAt).toBe(ts(expectedIntendedAt));
      expect(plan.earliestAt).toBe(ts(expectedEarliestAt));
      expect(plan.closureAt).toBe(ts(expectedClosureAt));

      // The frozen C1 contract parser rejects a plan whose closure precedes
      // its own earliest send opportunity; every computed plan must satisfy it.
      expect(() => parseDuePlan(plan)).not.toThrow();
    }
  );

  it("is a pure function of its inputs: recomputing after a simulated pause never bursts multiple steps", () => {
    const input: CadenceStepInput = {
      actualDm5SendAt: null,
      businessWindow,
      dm1AnchorAt: ts("2026-09-21T07:15:00.000Z"),
      priorActualSendAt: ts("2026-09-29T07:15:00.000Z"),
      step: "DM3",
    };

    const dispatchedBeforePause = planDirectMessageDuePlan(input);
    const dispatchedAfterPause = planDirectMessageDuePlan(input);

    expect(dispatchedAfterPause).toStrictEqual(dispatchedBeforePause);
    expect(dispatchedAfterPause.step).toBe("DM3");
  });

  it("rejects a DM1 plan that carries a prior direct-message send", () => {
    expect(() =>
      planDirectMessageDuePlan({
        actualDm5SendAt: null,
        businessWindow,
        dm1AnchorAt: ts("2026-09-21T08:00:00.000Z"),
        priorActualSendAt: ts("2026-09-20T08:00:00.000Z"),
        step: "DM1",
      })
    ).toThrow();
  });

  it("rejects a DM2 plan missing the actual DM1 send", () => {
    expect(() =>
      planDirectMessageDuePlan({
        actualDm5SendAt: null,
        businessWindow,
        dm1AnchorAt: ts("2026-09-21T08:00:00.000Z"),
        priorActualSendAt: null,
        step: "DM2",
      })
    ).toThrow();
  });
});
