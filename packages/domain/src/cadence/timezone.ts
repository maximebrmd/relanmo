import { ContractValidationError } from "../contracts/runtime";
import type {
  BusinessTimeZone,
  BusinessWeekday,
  UtcTimestamp,
} from "../contracts/values";

function weekdayFromShortName(shortName: string): BusinessWeekday | undefined {
  switch (shortName) {
    case "Mon": {
      return "MONDAY";
    }
    case "Tue": {
      return "TUESDAY";
    }
    case "Wed": {
      return "WEDNESDAY";
    }
    case "Thu": {
      return "THURSDAY";
    }
    case "Fri": {
      return "FRIDAY";
    }
    case "Sat": {
      return "SATURDAY";
    }
    case "Sun": {
      return "SUNDAY";
    }
    default: {
      return undefined;
    }
  }
}

export type LocalWallTime = Readonly<{
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}>;

export type LocalWallTimeWithWeekday = LocalWallTime &
  Readonly<{ weekday: BusinessWeekday }>;

function epochMsOf(instant: UtcTimestamp): number {
  return Date.parse(instant);
}

function toUtcTimestamp(epochMs: number): UtcTimestamp {
  // SAFETY: Date#toISOString always produces the canonical pattern parseUtcTimestamp expects.
  return new Date(epochMs).toISOString() as UtcTimestamp;
}

function offsetMinutesAt(epochMs: number, timeZone: BusinessTimeZone): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(epochMs));
  const offset = parts.find((part) => part.type === "timeZoneName")?.value;
  if (offset === undefined) {
    throw new ContractValidationError(
      `unable to resolve UTC offset for ${timeZone}`
    );
  }
  if (offset === "GMT") {
    return 0;
  }
  const match = /^GMT(?<sign>[+-])(?<hours>\d{1,2}):(?<minutes>\d{2})$/u.exec(
    offset
  );
  if (!match?.groups) {
    throw new ContractValidationError(
      `unrecognized UTC offset format: ${offset}`
    );
  }
  const { sign, hours, minutes } = match.groups;
  const magnitude = Number(hours) * 60 + Number(minutes);
  return sign === "-" ? -magnitude : magnitude;
}

export function localWallTimeAt(
  instant: UtcTimestamp,
  timeZone: BusinessTimeZone
): LocalWallTimeWithWeekday {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    weekday: "short",
    year: "numeric",
  });
  const parts = formatter.formatToParts(new Date(epochMsOf(instant)));
  const read = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((candidate) => candidate.type === type);
    if (part === undefined) {
      throw new ContractValidationError(
        `missing ${type} while resolving local time`
      );
    }
    return part.value;
  };
  const weekdayShortName = read("weekday");
  const weekday = weekdayFromShortName(weekdayShortName);
  if (weekday === undefined) {
    throw new ContractValidationError(
      `unrecognized weekday: ${weekdayShortName}`
    );
  }
  return {
    day: Number(read("day")),
    // Midnight can format as "24" under h23 in some ICU builds; normalize to 0.
    hour: Number(read("hour")) % 24,
    minute: Number(read("minute")),
    month: Number(read("month")),
    second: Number(read("second")),
    weekday,
    year: Number(read("year")),
  };
}

/**
 * Binary-searches the exact instant at which the zone's UTC offset first
 * becomes `targetOffset`, given a bound already at that offset (`afterMs`)
 * and a bound still at the prior offset (`beforeMs`).
 */
function findOffsetTransitionInstant(
  beforeMs: number,
  afterMs: number,
  timeZone: BusinessTimeZone,
  targetOffset: number
): number {
  let lowMs = beforeMs;
  let highMs = afterMs;
  while (highMs - lowMs > 1) {
    const midMs = lowMs + Math.floor((highMs - lowMs) / 2);
    if (offsetMinutesAt(midMs, timeZone) === targetOffset) {
      highMs = midMs;
    } else {
      lowMs = midMs;
    }
  }
  return highMs;
}

function utcInstantForLocalWallTime(
  local: LocalWallTime,
  timeZone: BusinessTimeZone
): number {
  const naiveUtcMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second
  );
  const firstOffset = offsetMinutesAt(naiveUtcMs, timeZone);
  const firstCandidateMs = naiveUtcMs - firstOffset * 60_000;
  const secondOffset = offsetMinutesAt(firstCandidateMs, timeZone);
  if (secondOffset === firstOffset) {
    return firstCandidateMs;
  }
  const secondCandidateMs = naiveUtcMs - secondOffset * 60_000;
  if (secondOffset < firstOffset) {
    // A spring-forward transition is nearby, but interpreting the local
    // digits as if they were UTC (the naive guess above) can coincidentally
    // land exactly on the transition instant even for an ordinary, valid
    // local time shortly before it -- that alone doesn't prove a gap.
    // Verify the second candidate actually round-trips to secondOffset
    // before concluding the requested local time never occurred.
    if (offsetMinutesAt(secondCandidateMs, timeZone) === secondOffset) {
      return secondCandidateMs;
    }
    // Neither offset round-trips: the requested local wall-clock time
    // falls inside the gap. Resolve to the transition instant itself --
    // the first valid instant at or after the requested time.
    return findOffsetTransitionInstant(
      firstCandidateMs,
      naiveUtcMs,
      timeZone,
      firstOffset
    );
  }
  // Fall-back: the requested local wall-clock time is ambiguous (it occurs
  // twice). Resolve with the offset that applies at the candidate instant.
  return secondCandidateMs;
}

/** Resolves a local Europe/Paris wall-clock time to its UTC instant, honoring DST. */
export function localWallTimeForDate(
  local: LocalWallTime,
  timeZone: BusinessTimeZone
): UtcTimestamp {
  return toUtcTimestamp(utcInstantForLocalWallTime(local, timeZone));
}

/**
 * Adds whole calendar days in the given local time zone, preserving the local
 * time-of-day across DST transitions instead of shifting by a fixed duration.
 */
export function addLocalCalendarDays(
  instant: UtcTimestamp,
  days: number,
  timeZone: BusinessTimeZone
): UtcTimestamp {
  const local = localWallTimeAt(instant, timeZone);
  return localWallTimeForDate({ ...local, day: local.day + days }, timeZone);
}

export function compareUtcTimestamps(a: UtcTimestamp, b: UtcTimestamp): number {
  return epochMsOf(a) - epochMsOf(b);
}

export function laterUtcTimestamp(
  a: UtcTimestamp,
  b: UtcTimestamp
): UtcTimestamp {
  return compareUtcTimestamps(a, b) >= 0 ? a : b;
}
