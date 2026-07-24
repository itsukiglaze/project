import "server-only";
import type { LocalDate } from "@/lib/calendar-math";

/**
 * Prisma's `@db.Date` columns are read/written as JS `Date` objects at the
 * driver boundary — there is no way to avoid touching `Date` entirely
 * once talking to Prisma. This file is the ONLY place that happens for
 * calendar code; every actual recurrence/date computation lives in
 * src/lib/calendar-math and uses plain {year,month,day} LocalDate values.
 *
 * Both directions here go through `Date.UTC(...)` / `getUTC*()` explicitly
 * — never the host-timezone-dependent `new Date(y, m, d)` constructor or
 * `getFullYear()`/`getMonth()`/`getDate()` — so the conversion itself
 * introduces no drift regardless of the server process's local TZ.
 */
export function localDateToUtcDate(date: LocalDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

export function utcDateToLocalDate(date: Date): LocalDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}
