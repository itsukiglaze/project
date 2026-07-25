import { describe, expect, it } from "vitest";
import { RecurrenceEndType, RecurrenceFrequency } from "@/lib/calendar-math";
import { getNextOccurrenceDate } from "./next-occurrence";
import type { RecurrenceRuleDto } from "./api";

function rule(overrides: Partial<RecurrenceRuleDto> = {}): RecurrenceRuleDto {
  return {
    frequency: RecurrenceFrequency.DAILY,
    interval: 1,
    daysOfWeek: [],
    dayOfMonth: null,
    startDate: "2026-01-01",
    endType: RecurrenceEndType.NEVER,
    endDate: null,
    occurrenceCount: null,
    ...overrides,
  };
}

describe("getNextOccurrenceDate", () => {
  it("returns the from-date itself for a daily series already started", () => {
    const next = getNextOccurrenceDate(rule(), { year: 2026, month: 1, day: 15 });
    expect(next).toEqual({ year: 2026, month: 1, day: 15 });
  });

  it("returns the first future date for a weekly series not due today", () => {
    // 2026-01-15 is a Thursday (dow 4); next Monday (dow 1) is 2026-01-19.
    const next = getNextOccurrenceDate(
      rule({ frequency: RecurrenceFrequency.WEEKLY, daysOfWeek: [1] }),
      { year: 2026, month: 1, day: 15 },
    );
    expect(next).toEqual({ year: 2026, month: 1, day: 19 });
  });

  it("returns null once the series has already ended before `from`", () => {
    const next = getNextOccurrenceDate(
      rule({ endType: RecurrenceEndType.UNTIL_DATE, endDate: "2026-01-10" }),
      { year: 2026, month: 1, day: 15 },
    );
    expect(next).toBeNull();
  });

  it("returns null for a series that hasn't started within the lookahead horizon", () => {
    const next = getNextOccurrenceDate(rule({ startDate: "2030-01-01" }), {
      year: 2026,
      month: 1,
      day: 15,
    });
    expect(next).toBeNull();
  });
});
