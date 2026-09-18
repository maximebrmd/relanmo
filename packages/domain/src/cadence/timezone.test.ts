import { describe, expect, it } from "vitest";

import type { UtcTimestamp } from "../contracts/values";
import { BUSINESS_TIME_ZONE, parseUtcTimestamp } from "../contracts/values";
import {
  addLocalCalendarDays,
  compareUtcTimestamps,
  laterUtcTimestamp,
  localWallTimeAt,
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
