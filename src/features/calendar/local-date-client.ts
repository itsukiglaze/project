"use client";

import { parseLocalDate, type LocalDate } from "@/lib/calendar-math";

/**
 * "Today" as the browser sees it, via `Intl.DateTimeFormat` (which
 * correctly handles the local UTC offset) — the resulting "YYYY-MM-DD"
 * string is then parsed with calendar-math's own strict parser. This is
 * the one place a calendar-day value needs a real wall-clock reference;
 * it is never used for recurrence arithmetic itself, and it never
 * constructs a LocalDate via `new Date(year, month, day)`.
 */
export function getTodayLocalDate(): LocalDate {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return parseLocalDate(formatter.format(new Date()));
}
