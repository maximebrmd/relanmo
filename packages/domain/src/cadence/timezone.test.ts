import { describe, expect, it } from "vitest";

import type { UtcTimestamp } from "../contracts/values";
import { BUSINESS_TIME_ZONE, parseUtcTimestamp } from "../contracts/values";
import {
  addLocalCalendarDays,
  compareUtcTimestamps,
  laterUtcTimestamp,
  localWallTimeAt,
  localWallTimeForDate,
} from "./timezone";

function ts(value: string): UtcTimestamp {
  return parseUtcTimestamp(value);
}

describe("addLocalCalendarDays", () => {
  const cases: readonly {
    readonly name: string;
    readonly instant: string;
    readonly days: number;
    readonly expected: string;
  }[] = [
    {
      days: 2,
      expected: "2026-03-30T07:30:00.000Z",
      instant: "2026-03-28T08:30:00.000Z",
      name: "spring-forward: clocks jump 02:00->03:00 on 2026-03-29, losing an hour of UTC offset",
    },
    {
      days: 2,
      expected: "2026-10-26T08:30:00.000Z",
      instant: "2026-10-24T07:30:00.000Z",
      name: "fall-back: clocks repeat 03:00->02:00 on 2026-10-25, gaining an hour of UTC offset",
    },
    {
      days: 0,
      expected: "2026-09-21T07:15:00.000Z",
      instant: "2026-09-21T07:15:00.000Z",
      name: "zero days returns the same instant",
    },
    {
      days: 21,
      expected: "2026-10-12T07:15:00.000Z",
      instant: "2026-09-21T07:15:00.000Z",
      name: "adding 21 days keeps the local 09:15 time-of-day across a month boundary",
    },
  ];

  it.each(cases)("$name", ({ instant, days, expected }) => {
    const result = addLocalCalendarDays(ts(instant), days, BUSINESS_TIME_ZONE);
    expect(result).toBe(ts(expected));
  });
});

describe("localWallTimeAt", () => {
  it("resolves the Europe/Paris weekday and local time-of-day", () => {
    const local = localWallTimeAt(
      ts("2026-09-21T07:15:00.000Z"),
      BUSINESS_TIME_ZONE
    );
    expect(local).toEqual({
      day: 21,
      hour: 9,
      minute: 15,
      month: 9,
      second: 0,
      weekday: "MONDAY",
      year: 2026,
    });
  });
});

describe("localWallTimeForDate", () => {
  it("clamps a local wall time inside the spring-forward gap to the transition instant", () => {
    // 02:30 never occurs on 2026-03-29: Europe/Paris clocks jump straight
    // from 02:00 to 03:00. The first valid instant at or after 02:30 is
    // that transition itself, local 03:00 (2026-03-29T01:00:00.000Z UTC).
    const result = localWallTimeForDate(
      { day: 29, hour: 2, minute: 30, month: 3, second: 0, year: 2026 },
      BUSINESS_TIME_ZONE
    );
    expect(result).toBe(ts("2026-03-29T01:00:00.000Z"));
    expect(localWallTimeAt(result, BUSINESS_TIME_ZONE)).toEqual({
      day: 29,
      hour: 3,
      minute: 0,
      month: 3,
      second: 0,
      weekday: "SUNDAY",
      year: 2026,
    });
  });

  it("resolves a local wall time outside any gap exactly", () => {
    const result = localWallTimeForDate(
      { day: 21, hour: 9, minute: 15, month: 9, second: 0, year: 2026 },
      BUSINESS_TIME_ZONE
    );
    expect(result).toBe(ts("2026-09-21T07:15:00.000Z"));
  });
});

describe("compareUtcTimestamps and laterUtcTimestamp", () => {
  it("orders instants and picks the later one", () => {
    const earlier = ts("2026-09-21T07:15:00.000Z");
    const later = ts("2026-09-22T07:15:00.000Z");
    expect(compareUtcTimestamps(earlier, later)).toBeLessThan(0);
    expect(compareUtcTimestamps(later, earlier)).toBeGreaterThan(0);
    expect(compareUtcTimestamps(earlier, earlier)).toBe(0);
    expect(laterUtcTimestamp(earlier, later)).toBe(later);
    expect(laterUtcTimestamp(later, earlier)).toBe(later);
  });
});
