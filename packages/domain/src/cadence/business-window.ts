import { ContractValidationError } from "../contracts/runtime";
import type {
  BusinessWindowConfiguration,
  LocalBusinessTime,
  UtcTimestamp,
} from "../contracts/values";
import {
  addLocalCalendarDays,
  compareUtcTimestamps,
  localWallTimeAt,
  localWallTimeForDate,
} from "./timezone";

/** How far forward to search for the next open window before giving up. */
const SEARCH_HORIZON_DAYS = 8;

function parseLocalClock(value: LocalBusinessTime) {
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute };
}

function requireWindows(config: BusinessWindowConfiguration): void {
  if (config.windows.length === 0) {
    throw new ContractValidationError(
      "business window configuration has no windows"
    );
  }
}

export function isWithinBusinessWindow(
  instant: UtcTimestamp,
  config: BusinessWindowConfiguration
): boolean {
  requireWindows(config);
  const local = localWallTimeAt(instant, config.businessTimeZone);
  const minuteOfDay = local.hour * 60 + local.minute;
  return config.windows.some((window) => {
    if (window.weekday !== local.weekday) {
      return false;
    }
    const opens = parseLocalClock(window.opensAt);
    const closes = parseLocalClock(window.closesAt);
    const opensMinute = opens.hour * 60 + opens.minute;
    const closesMinute = closes.hour * 60 + closes.minute;
    return minuteOfDay >= opensMinute && minuteOfDay < closesMinute;
  });
}

/**
 * Returns `instant` unchanged when it already falls inside a permitted
 * business window, otherwise the earliest later instant that does.
 */
export function nextPermittedInstant(
  instant: UtcTimestamp,
  config: BusinessWindowConfiguration
): UtcTimestamp {
  requireWindows(config);
  if (isWithinBusinessWindow(instant, config)) {
    return instant;
  }

  for (let dayOffset = 0; dayOffset <= SEARCH_HORIZON_DAYS; dayOffset += 1) {
    const dayAnchor =
      dayOffset === 0
        ? instant
        : addLocalCalendarDays(instant, dayOffset, config.businessTimeZone);
    const local = localWallTimeAt(dayAnchor, config.businessTimeZone);
    const windowsForDay = config.windows.filter(
      (window) => window.weekday === local.weekday
    );

    let earliestUpcomingOpensAt: UtcTimestamp | null = null;
    for (const window of windowsForDay) {
      const opens = parseLocalClock(window.opensAt);
      const opensAt = localWallTimeForDate(
        {
          day: local.day,
          hour: opens.hour,
          minute: opens.minute,
          month: local.month,
          second: 0,
          year: local.year,
        },
        config.businessTimeZone
      );
      if (compareUtcTimestamps(opensAt, instant) <= 0) {
        continue;
      }
      if (
        earliestUpcomingOpensAt === null ||
        compareUtcTimestamps(opensAt, earliestUpcomingOpensAt) < 0
      ) {
        earliestUpcomingOpensAt = opensAt;
      }
    }

    if (earliestUpcomingOpensAt !== null) {
      return earliestUpcomingOpensAt;
    }
  }

  throw new ContractValidationError(
    "no permitted business window found within search horizon"
  );
}
