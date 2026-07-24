import "server-only";
import { parseLocalDate, type LocalDate } from "@/lib/calendar-math";

/**
 * "Today" in the given IANA timezone, via `Intl.DateTimeFormat` (which
 * correctly handles the UTC-offset conversion), then parsed with
 * calendar-math's own strict, drift-free parser. This is one of the very
 * few places JS `Date` appears in this codebase — see calendar-math's own
 * docs for the other. Throws if `timezone` is not a valid IANA zone name;
 * see `getTodayInTimezoneOrUtc` for a fallback-safe wrapper.
 */
export function getTodayInTimezone(timezone: string): LocalDate {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return parseLocalDate(formatter.format(new Date()));
}

/** Same as getTodayInTimezone, but falls back to UTC if `timezone` is invalid. */
export function getTodayInTimezoneOrUtc(timezone: string): LocalDate {
  try {
    return getTodayInTimezone(timezone);
  } catch {
    return getTodayInTimezone("UTC");
  }
}
