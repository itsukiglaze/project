import { describe, expect, it } from "vitest";
import type { LocalDate } from "./local-date";
import {
  MAX_RECURRENCE_ITERATIONS,
  expandRecurrence,
  validateRecurrenceRule,
  type RecurrenceRule,
} from "./recurrence";
import { RecurrenceEndType, RecurrenceFrequency } from "./types";

function d(year: number, month: number, day: number): LocalDate {
  return { year, month, day };
}

function baseRule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return {
    frequency: RecurrenceFrequency.DAILY,
    interval: 1,
    daysOfWeek: [],
    dayOfMonth: null,
    startDate: d(2026, 1, 1),
    endType: RecurrenceEndType.NEVER,
    endDate: null,
    occurrenceCount: null,
    ...overrides,
  };
}

describe("validateRecurrenceRule", () => {
  it("accepts a minimal valid DAILY rule", () => {
    expect(validateRecurrenceRule(baseRule()).ok).toBe(true);
  });

  it("rejects interval < 1", () => {
    expect(validateRecurrenceRule(baseRule({ interval: 0 })).ok).toBe(false);
  });

  it("rejects a fractional interval", () => {
    expect(validateRecurrenceRule(baseRule({ interval: 1.5 })).ok).toBe(false);
  });

  it("WEEKLY requires non-empty daysOfWeek", () => {
    const rule = baseRule({ frequency: RecurrenceFrequency.WEEKLY, daysOfWeek: [] });
    expect(validateRecurrenceRule(rule).ok).toBe(false);
  });

  it("WEEKLY rejects an out-of-range day-of-week", () => {
    const rule = baseRule({ frequency: RecurrenceFrequency.WEEKLY, daysOfWeek: [7] });
    expect(validateRecurrenceRule(rule).ok).toBe(false);
  });

  it("WEEKLY rejects duplicate days-of-week", () => {
    const rule = baseRule({ frequency: RecurrenceFrequency.WEEKLY, daysOfWeek: [1, 1] });
    expect(validateRecurrenceRule(rule).ok).toBe(false);
  });

  it("WEEKLY accepts a valid set of days", () => {
    const rule = baseRule({ frequency: RecurrenceFrequency.WEEKLY, daysOfWeek: [1, 3, 5] });
    expect(validateRecurrenceRule(rule).ok).toBe(true);
  });

  it("MONTHLY requires dayOfMonth", () => {
    const rule = baseRule({ frequency: RecurrenceFrequency.MONTHLY, dayOfMonth: null });
    expect(validateRecurrenceRule(rule).ok).toBe(false);
  });

  it("MONTHLY rejects dayOfMonth outside 1..31", () => {
    expect(
      validateRecurrenceRule(baseRule({ frequency: RecurrenceFrequency.MONTHLY, dayOfMonth: 32 })).ok,
    ).toBe(false);
    expect(
      validateRecurrenceRule(baseRule({ frequency: RecurrenceFrequency.MONTHLY, dayOfMonth: 0 })).ok,
    ).toBe(false);
  });

  it("MONTHLY accepts dayOfMonth 31 (clamping happens at expansion time, not validation)", () => {
    expect(
      validateRecurrenceRule(baseRule({ frequency: RecurrenceFrequency.MONTHLY, dayOfMonth: 31 })).ok,
    ).toBe(true);
  });

  it("DAILY rejects a stray daysOfWeek/dayOfMonth", () => {
    expect(validateRecurrenceRule(baseRule({ daysOfWeek: [1] })).ok).toBe(false);
    expect(validateRecurrenceRule(baseRule({ dayOfMonth: 5 })).ok).toBe(false);
  });

  it("UNTIL_DATE requires endDate", () => {
    const rule = baseRule({ endType: RecurrenceEndType.UNTIL_DATE, endDate: null });
    expect(validateRecurrenceRule(rule).ok).toBe(false);
  });

  it("UNTIL_DATE rejects endDate before startDate", () => {
    const rule = baseRule({
      endType: RecurrenceEndType.UNTIL_DATE,
      endDate: d(2025, 12, 31),
    });
    expect(validateRecurrenceRule(rule).ok).toBe(false);
  });

  it("UNTIL_DATE accepts endDate == startDate", () => {
    const rule = baseRule({ endType: RecurrenceEndType.UNTIL_DATE, endDate: d(2026, 1, 1) });
    expect(validateRecurrenceRule(rule).ok).toBe(true);
  });

  it("AFTER_COUNT requires occurrenceCount >= 1", () => {
    expect(
      validateRecurrenceRule(baseRule({ endType: RecurrenceEndType.AFTER_COUNT, occurrenceCount: null }))
        .ok,
    ).toBe(false);
    expect(
      validateRecurrenceRule(baseRule({ endType: RecurrenceEndType.AFTER_COUNT, occurrenceCount: 0 })).ok,
    ).toBe(false);
  });

  it("AFTER_COUNT accepts occurrenceCount = 1", () => {
    expect(
      validateRecurrenceRule(baseRule({ endType: RecurrenceEndType.AFTER_COUNT, occurrenceCount: 1 })).ok,
    ).toBe(true);
  });

  it("NEVER rejects a stray endDate/occurrenceCount", () => {
    expect(validateRecurrenceRule(baseRule({ endDate: d(2026, 6, 1) })).ok).toBe(false);
    expect(validateRecurrenceRule(baseRule({ occurrenceCount: 5 })).ok).toBe(false);
  });
});

describe("expandRecurrence - DAILY", () => {
  it("every day within range", () => {
    const rule = baseRule({ startDate: d(2026, 1, 1) });
    const result = expandRecurrence(rule, d(2026, 1, 1), d(2026, 1, 5));
    expect(result).toEqual([d(2026, 1, 1), d(2026, 1, 2), d(2026, 1, 3), d(2026, 1, 4), d(2026, 1, 5)]);
  });

  it("every N days (interval)", () => {
    const rule = baseRule({ startDate: d(2026, 1, 1), interval: 3 });
    const result = expandRecurrence(rule, d(2026, 1, 1), d(2026, 1, 10));
    expect(result).toEqual([d(2026, 1, 1), d(2026, 1, 4), d(2026, 1, 7), d(2026, 1, 10)]);
  });

  it("no occurrences before startDate even if the window starts earlier", () => {
    const rule = baseRule({ startDate: d(2026, 1, 5) });
    const result = expandRecurrence(rule, d(2026, 1, 1), d(2026, 1, 10));
    expect(result[0]).toEqual(d(2026, 1, 5));
    expect(result).not.toContainEqual(d(2026, 1, 1));
  });

  it("respects UNTIL_DATE", () => {
    const rule = baseRule({
      startDate: d(2026, 1, 1),
      endType: RecurrenceEndType.UNTIL_DATE,
      endDate: d(2026, 1, 3),
    });
    const result = expandRecurrence(rule, d(2026, 1, 1), d(2026, 1, 10));
    expect(result).toEqual([d(2026, 1, 1), d(2026, 1, 2), d(2026, 1, 3)]);
  });

  it("respects AFTER_COUNT counted from the series' true start, not the requested range", () => {
    const rule = baseRule({
      startDate: d(2026, 1, 1),
      endType: RecurrenceEndType.AFTER_COUNT,
      occurrenceCount: 5,
    });
    // Ask for a window that starts AFTER the series would already be exhausted.
    const result = expandRecurrence(rule, d(2026, 1, 10), d(2026, 1, 20));
    expect(result).toEqual([]); // occurrences 1-5 were Jan 1-5, all before the window
  });

  it("AFTER_COUNT correctly includes occurrences that straddle the window boundary", () => {
    const rule = baseRule({
      startDate: d(2026, 1, 1),
      endType: RecurrenceEndType.AFTER_COUNT,
      occurrenceCount: 5,
    });
    // Occurrences are Jan 1,2,3,4,5. Window is Jan 3-10 -> only 3,4,5 show.
    const result = expandRecurrence(rule, d(2026, 1, 3), d(2026, 1, 10));
    expect(result).toEqual([d(2026, 1, 3), d(2026, 1, 4), d(2026, 1, 5)]);
  });

  it("returns [] when rangeEnd is before rangeStart", () => {
    const rule = baseRule();
    expect(expandRecurrence(rule, d(2026, 1, 10), d(2026, 1, 1))).toEqual([]);
  });

  it("hard iteration cap prevents runaway loops and still returns cleanly", () => {
    const rule = baseRule({
      startDate: d(1900, 1, 1),
      endType: RecurrenceEndType.UNTIL_DATE,
      endDate: d(2900, 1, 1), // ~1000 years of daily occurrences
    });
    const result = expandRecurrence(rule, d(2895, 1, 1), d(2895, 1, 2));
    // The 1000-year span exceeds MAX_RECURRENCE_ITERATIONS well before
    // reaching this far-future window, so nothing from it can appear —
    // the important thing is this returns quickly instead of hanging.
    expect(result).toEqual([]);
    expect(MAX_RECURRENCE_ITERATIONS).toBeGreaterThan(0);
  });
});

describe("expandRecurrence - WEEKLY", () => {
  it("occurs on each selected day-of-week, every week", () => {
    // 2026-01-01 is a Thursday. Select Mon/Wed/Fri.
    const rule = baseRule({
      frequency: RecurrenceFrequency.WEEKLY,
      daysOfWeek: [1, 3, 5],
      startDate: d(2026, 1, 1),
    });
    const result = expandRecurrence(rule, d(2026, 1, 1), d(2026, 1, 14));
    // Week of Jan 1 (Thu): only Fri Jan 2 qualifies (Mon/Wed already passed
    // before startDate). Week of Jan 5 (Mon): Mon 5, Wed 7, Fri 9. Week of
    // Jan 12: Mon 12, Wed 14.
    expect(result).toEqual([
      d(2026, 1, 2),
      d(2026, 1, 5),
      d(2026, 1, 7),
      d(2026, 1, 9),
      d(2026, 1, 12),
      d(2026, 1, 14),
    ]);
  });

  it("every N weeks (interval)", () => {
    // Every 2 weeks on Monday, starting Monday 2026-01-05.
    const rule = baseRule({
      frequency: RecurrenceFrequency.WEEKLY,
      daysOfWeek: [1],
      startDate: d(2026, 1, 5),
      interval: 2,
    });
    const result = expandRecurrence(rule, d(2026, 1, 1), d(2026, 2, 28));
    expect(result).toEqual([d(2026, 1, 5), d(2026, 1, 19), d(2026, 2, 2), d(2026, 2, 16)]);
  });

  it("does not produce an occurrence before startDate within the start week", () => {
    // Start on Wednesday, select Mon/Wed — Monday of the start week must not appear.
    const rule = baseRule({
      frequency: RecurrenceFrequency.WEEKLY,
      daysOfWeek: [1, 3],
      startDate: d(2026, 1, 7), // a Wednesday
    });
    const result = expandRecurrence(rule, d(2026, 1, 1), d(2026, 1, 14));
    expect(result).not.toContainEqual(d(2026, 1, 5)); // the Monday before startDate
    expect(result[0]).toEqual(d(2026, 1, 7));
  });
});

describe("expandRecurrence - MONTHLY", () => {
  it("occurs on the given day-of-month each month", () => {
    const rule = baseRule({
      frequency: RecurrenceFrequency.MONTHLY,
      dayOfMonth: 15,
      startDate: d(2026, 1, 15),
    });
    const result = expandRecurrence(rule, d(2026, 1, 1), d(2026, 4, 30));
    expect(result).toEqual([d(2026, 1, 15), d(2026, 2, 15), d(2026, 3, 15), d(2026, 4, 15)]);
  });

  it("clamps dayOfMonth=31 to the last valid day of shorter months", () => {
    const rule = baseRule({
      frequency: RecurrenceFrequency.MONTHLY,
      dayOfMonth: 31,
      startDate: d(2026, 1, 31),
    });
    const result = expandRecurrence(rule, d(2026, 1, 1), d(2026, 4, 30));
    // Jan 31, Feb 28 (2026 non-leap), Mar 31, Apr 30.
    expect(result).toEqual([d(2026, 1, 31), d(2026, 2, 28), d(2026, 3, 31), d(2026, 4, 30)]);
  });

  it("clamps to Feb 29 in a leap year", () => {
    const rule = baseRule({
      frequency: RecurrenceFrequency.MONTHLY,
      dayOfMonth: 31,
      startDate: d(2024, 1, 31),
    });
    const result = expandRecurrence(rule, d(2024, 1, 1), d(2024, 2, 29));
    expect(result).toEqual([d(2024, 1, 31), d(2024, 2, 29)]);
  });

  it("every N months (interval)", () => {
    const rule = baseRule({
      frequency: RecurrenceFrequency.MONTHLY,
      dayOfMonth: 1,
      startDate: d(2026, 1, 1),
      interval: 3,
    });
    const result = expandRecurrence(rule, d(2026, 1, 1), d(2026, 12, 31));
    expect(result).toEqual([d(2026, 1, 1), d(2026, 4, 1), d(2026, 7, 1), d(2026, 10, 1)]);
  });

  it("if the clamped date falls before startDate in the start month, that month is skipped (not shifted)", () => {
    // Start on the 20th, but dayOfMonth is 5 -> the 5th of the start
    // month is before startDate, so the first occurrence is next month.
    const rule = baseRule({
      frequency: RecurrenceFrequency.MONTHLY,
      dayOfMonth: 5,
      startDate: d(2026, 1, 20),
    });
    const result = expandRecurrence(rule, d(2026, 1, 1), d(2026, 3, 31));
    expect(result).toEqual([d(2026, 2, 5), d(2026, 3, 5)]);
  });
});
