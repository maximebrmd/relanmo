import { describe, expect, it } from "vitest";

import { parseBusinessWindowConfiguration } from "../contracts/parsers";
import type { UtcTimestamp } from "../contracts/values";
import {
  DEFAULT_BUSINESS_WINDOW_CONFIGURATION,
  parseUtcTimestamp,
} from "../contracts/values";
import {
  isWithinBusinessWindow,
  nextPermittedInstant,
} from "./business-window";

function ts(value: string): UtcTimestamp {
  return parseUtcTimestamp(value);
}

describe("isWithinBusinessWindow", () => {
  it("is open during a Monday business hour", () => {
    expect(
      isWithinBusinessWindow(
        ts("2026-09-21T10:00:00.000Z"),
        DEFAULT_BUSINESS_WINDOW_CONFIGURATION
      )
    ).toBe(true);
  });

  it("is closed on a Saturday", () => {
    expect(
      isWithinBusinessWindow(
        ts("2026-09-19T10:00:00.000Z"),
        DEFAULT_BUSINESS_WINDOW_CONFIGURATION
      )
    ).toBe(false);
  });

  it("is closed exactly at the window close boundary", () => {
    expect(
      isWithinBusinessWindow(
        ts("2026-09-21T16:00:00.000Z"),
        DEFAULT_BUSINESS_WINDOW_CONFIGURATION
      )
    ).toBe(false);
  });

  it("throws for a configuration with no windows", () => {
    expect(() =>
      isWithinBusinessWindow(ts("2026-09-21T10:00:00.000Z"), {
        businessTimeZone: "Europe/Paris",
        windows: [],
      })
    ).toThrow();
  });
});

describe("nextPermittedInstant", () => {
  it("returns the same instant when already open", () => {
    const instant = ts("2026-09-21T10:00:00.000Z");
    expect(
      nextPermittedInstant(instant, DEFAULT_BUSINESS_WINDOW_CONFIGURATION)
    ).toBe(instant);
  });

  it("moves a Saturday instant to Monday's opening", () => {
    expect(
      nextPermittedInstant(
        ts("2026-09-19T12:00:00.000Z"),
        DEFAULT_BUSINESS_WINDOW_CONFIGURATION
      )
    ).toBe(ts("2026-09-21T07:00:00.000Z"));
  });

  it("moves a Friday-evening instant to the next Monday's opening", () => {
    expect(
      nextPermittedInstant(
        ts("2026-09-18T18:00:00.000Z"),
        DEFAULT_BUSINESS_WINDOW_CONFIGURATION
      )
    ).toBe(ts("2026-09-21T07:00:00.000Z"));
  });

  it("moves a pre-opening instant to the same day's opening", () => {
    expect(
      nextPermittedInstant(
        ts("2026-09-21T05:00:00.000Z"),
        DEFAULT_BUSINESS_WINDOW_CONFIGURATION
      )
    ).toBe(ts("2026-09-21T07:00:00.000Z"));
  });

  it("throws for a configuration with no windows", () => {
    expect(() =>
      nextPermittedInstant(ts("2026-09-21T10:00:00.000Z"), {
        businessTimeZone: "Europe/Paris",
        windows: [],
      })
    ).toThrow();
  });

  it("skips a configured window whose opening falls inside the spring-forward DST gap", () => {
    // 2026-03-29 is the Europe/Paris spring-forward transition: local clocks
    // jump 02:00 -> 03:00, so 02:30 never occurs that day. A naive resolution
    // round-trips it to local 03:30, which falls outside this 02:30-03:00
    // window. The next valid candidate is Monday's ordinary opening.
    const dstGapConfig = parseBusinessWindowConfiguration({
      businessTimeZone: "Europe/Paris",
      windows: [
        { closesAt: "03:00", opensAt: "02:30", weekday: "SUNDAY" },
        { closesAt: "18:00", opensAt: "09:00", weekday: "MONDAY" },
      ],
    });

    expect(
      nextPermittedInstant(ts("2026-03-28T10:00:00.000Z"), dstGapConfig)
    ).toBe(ts("2026-03-30T07:00:00.000Z"));
  });
});
