/**
 * A calendar day with no time-of-day or timezone component. Deliberately
 * NOT a JS `Date` — a `Date` always carries an implicit UTC instant, and
 * constructing one via `new Date(year, month, day)` uses the HOST
 * process's local timezone, which silently drifts calendar-day math
 * whenever the server/test runner's TZ differs from the series' own
 * frozen `timezone` field. Every function below uses plain integer
 * arithmetic instead (the "days from civil" algorithm), so results are
 * 100% deterministic regardless of the host's timezone.
 */
export type LocalDate = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month - 1];
}

/** Clamps a requested day-of-month (1-31) to the last valid day of the given month/year. */
export function clampDayOfMonth(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

/**
 * Howard Hinnant's "days from civil" algorithm — pure integer arithmetic,
 * proleptic Gregorian, no floating point traps, no Date object. Returns
 * days since the Unix epoch (1970-01-01 = 0).
 */
export function toEpochDay(date: LocalDate): number {
  const y = date.month <= 2 ? date.year - 1 : date.year;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400; // [0, 399]
  const mp = (date.month + 9) % 12; // Mar=0 .. Feb=11
  const doy = Math.floor((153 * mp + 2) / 5) + date.day - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0, 146096]
  return era * 146097 + doe - 719468;
}

/** Inverse of toEpochDay. */
export function fromEpochDay(epochDay: number): LocalDate {
  const z = epochDay + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097; // [0, 146096]
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  ); // [0, 399]
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); // [0, 365]
  const mp = Math.floor((5 * doy + 2) / 153); // [0, 11]
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1; // [1, 31]
  const month = mp + (mp < 10 ? 3 : -9); // [1, 12]
  const year = y + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

export function compareLocalDate(a: LocalDate, b: LocalDate): -1 | 0 | 1 {
  const diff = toEpochDay(a) - toEpochDay(b);
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
}

export function addDays(date: LocalDate, amount: number): LocalDate {
  return fromEpochDay(toEpochDay(date) + amount);
}

/**
 * Calendar-aware month stepping — preserves the intended day-of-month,
 * clamping to the target month's last valid day (e.g. Jan 31 + 1 month ->
 * Feb 28/29, never rolling over into March).
 */
export function addMonths(date: LocalDate, amount: number, dayOverride?: number): LocalDate {
  const totalMonths = (date.month - 1) + amount;
  const year = date.year + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12 + 1;
  const day = clampDayOfMonth(year, month, dayOverride ?? date.day);
  return { year, month, day };
}

/** 0 = Sunday .. 6 = Saturday. Epoch day 0 (1970-01-01) was a Thursday (index 4). */
export function getDayOfWeek(date: LocalDate): number {
  const epochDay = toEpochDay(date);
  return ((epochDay % 7) + 7 + 4) % 7;
}

export function formatLocalDate(date: LocalDate): string {
  const y = String(date.year).padStart(4, "0");
  const m = String(date.month).padStart(2, "0");
  const d = String(date.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Strict "YYYY-MM-DD" parser. Throws on malformed input or an
 * out-of-range/impossible calendar date (e.g. 2026-02-30) — this is a
 * "should never happen given prior validation" assertion, matching the
 * convention already used by toValidatedSafeInt in the calculator feature.
 */
export function parseLocalDate(iso: string): LocalDate {
  const match = ISO_DATE_PATTERN.exec(iso);
  if (!match) {
    throw new Error(`parseLocalDate: "${iso}" is not a valid YYYY-MM-DD string`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) {
    throw new Error(`parseLocalDate: "${iso}" has an invalid month`);
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`parseLocalDate: "${iso}" has an invalid day for that month`);
  }
  return { year, month, day };
}
