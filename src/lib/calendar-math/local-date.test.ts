import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  clampDayOfMonth,
  compareLocalDate,
  daysInMonth,
  formatLocalDate,
  fromEpochDay,
  getDayOfWeek,
  isLeapYear,
  parseLocalDate,
  toEpochDay,
  type LocalDate,
} from "./local-date";

describe("isLeapYear / daysInMonth", () => {
  it("identifies standard leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
  });

  it("century years are leap only when divisible by 400", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });

  it("February has 28 or 29 days depending on leap year", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
  });

  it("returns correct day counts for 30/31-day months", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
});

describe("clampDayOfMonth", () => {
  it("passes through a valid day unchanged", () => {
    expect(clampDayOfMonth(2026, 1, 15)).toBe(15);
  });

  it("clamps 31 down to 28 in a non-leap February", () => {
    expect(clampDayOfMonth(2026, 2, 31)).toBe(28);
  });

  it("clamps 31 down to 29 in a leap February", () => {
    expect(clampDayOfMonth(2024, 2, 31)).toBe(29);
  });

  it("clamps 31 down to 30 in April", () => {
    expect(clampDayOfMonth(2026, 4, 31)).toBe(30);
  });
});

describe("toEpochDay / fromEpochDay round-trip", () => {
  const cases: LocalDate[] = [
    { year: 1970, month: 1, day: 1 },
    { year: 2000, month: 2, day: 29 },
    { year: 2026, month: 7, day: 24 },
    { year: 1969, month: 12, day: 31 },
    { year: 1900, month: 1, day: 1 },
    { year: 2400, month: 2, day: 29 },
  ];

  it.each(cases)("round-trips %o", (date) => {
    expect(fromEpochDay(toEpochDay(date))).toEqual(date);
  });

  it("epoch day 0 is 1970-01-01", () => {
    expect(toEpochDay({ year: 1970, month: 1, day: 1 })).toBe(0);
  });
});

describe("compareLocalDate", () => {
  it("orders across month/year boundaries correctly", () => {
    expect(compareLocalDate({ year: 2026, month: 1, day: 31 }, { year: 2026, month: 2, day: 1 })).toBe(-1);
    expect(compareLocalDate({ year: 2026, month: 12, day: 31 }, { year: 2027, month: 1, day: 1 })).toBe(-1);
  });

  it("returns 0 for equal dates", () => {
    expect(compareLocalDate({ year: 2026, month: 7, day: 24 }, { year: 2026, month: 7, day: 24 })).toBe(0);
  });

  it("returns 1 when the first date is later", () => {
    expect(compareLocalDate({ year: 2026, month: 8, day: 1 }, { year: 2026, month: 7, day: 24 })).toBe(1);
  });
});

describe("addDays", () => {
  it("adds across a month boundary", () => {
    expect(addDays({ year: 2026, month: 1, day: 31 }, 1)).toEqual({ year: 2026, month: 2, day: 1 });
  });

  it("adds across a leap-year February", () => {
    expect(addDays({ year: 2024, month: 2, day: 28 }, 1)).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it("subtracts (negative amount) across a year boundary", () => {
    expect(addDays({ year: 2026, month: 1, day: 1 }, -1)).toEqual({ year: 2025, month: 12, day: 31 });
  });
});

describe("addMonths", () => {
  it("preserves day-of-month when the target month is long enough", () => {
    expect(addMonths({ year: 2026, month: 1, day: 15 }, 1)).toEqual({ year: 2026, month: 2, day: 15 });
  });

  it("clamps Jan 31 + 1 month to Feb 28 (non-leap)", () => {
    expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it("clamps Jan 31 + 1 month to Feb 29 (leap year)", () => {
    expect(addMonths({ year: 2024, month: 1, day: 31 }, 1)).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it("rolls over the year when adding past December", () => {
    expect(addMonths({ year: 2026, month: 11, day: 30 }, 2)).toEqual({ year: 2027, month: 1, day: 30 });
  });

  it("handles negative month amounts", () => {
    expect(addMonths({ year: 2026, month: 3, day: 31 }, -1)).toEqual({ year: 2026, month: 2, day: 28 });
  });
});

describe("getDayOfWeek", () => {
  it("1970-01-01 is a Thursday (index 4)", () => {
    expect(getDayOfWeek({ year: 1970, month: 1, day: 1 })).toBe(4);
  });

  it("matches a known Sunday", () => {
    // 2026-07-26 is a Sunday.
    expect(getDayOfWeek({ year: 2026, month: 7, day: 26 })).toBe(0);
  });

  it("matches a known Saturday", () => {
    // 2026-07-25 is a Saturday.
    expect(getDayOfWeek({ year: 2026, month: 7, day: 25 })).toBe(6);
  });
});

describe("formatLocalDate / parseLocalDate", () => {
  it("formats with zero-padding", () => {
    expect(formatLocalDate({ year: 2026, month: 1, day: 5 })).toBe("2026-01-05");
  });

  it("parses a valid ISO date string", () => {
    expect(parseLocalDate("2026-07-24")).toEqual({ year: 2026, month: 7, day: 24 });
  });

  it("round-trips format -> parse", () => {
    const date = { year: 2026, month: 12, day: 31 };
    expect(parseLocalDate(formatLocalDate(date))).toEqual(date);
  });

  it("throws on a malformed string", () => {
    expect(() => parseLocalDate("not-a-date")).toThrow();
  });

  it("throws on an invalid month", () => {
    expect(() => parseLocalDate("2026-13-01")).toThrow();
  });

  it("throws on an impossible day (Feb 30)", () => {
    expect(() => parseLocalDate("2026-02-30")).toThrow();
  });

  it("throws on Feb 29 in a non-leap year", () => {
    expect(() => parseLocalDate("2026-02-29")).toThrow();
  });

  it("accepts Feb 29 in a leap year", () => {
    expect(parseLocalDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
  });
});
