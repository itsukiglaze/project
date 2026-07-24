import { describe, expect, it } from "vitest";
import {
  addMonthsToYearMonth,
  firstDateOfMonth,
  generateMonthGrid,
  lastDateOfMonth,
} from "./month-grid";

describe("generateMonthGrid", () => {
  it("produces only complete weeks of 7 days", () => {
    const weeks = generateMonthGrid(2026, 1);
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it("includes leading days from the previous month when the 1st isn't a Sunday", () => {
    // 2026-01-01 is a Thursday, so the grid must start on 2025-12-28 (Sunday).
    const weeks = generateMonthGrid(2026, 1);
    expect(weeks[0][0].date).toEqual({ year: 2025, month: 12, day: 28 });
    expect(weeks[0][0].isCurrentMonth).toBe(false);
  });

  it("includes trailing days from the next month to complete the last week", () => {
    // 2026-03-31 is a Tuesday, so trailing days from April are needed.
    const weeks = generateMonthGrid(2026, 3);
    const lastWeek = weeks[weeks.length - 1];
    const lastCell = lastWeek[lastWeek.length - 1];
    expect(lastCell.date.month).toBe(4);
    expect(lastCell.isCurrentMonth).toBe(false);
  });

  it("marks every day of the requested month as isCurrentMonth", () => {
    const weeks = generateMonthGrid(2026, 2); // February 2026, 28 days
    const currentMonthCells = weeks.flat().filter((c) => c.isCurrentMonth);
    expect(currentMonthCells).toHaveLength(28);
    expect(currentMonthCells[0].date).toEqual({ year: 2026, month: 2, day: 1 });
    expect(currentMonthCells[27].date).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it("handles a month starting exactly on Sunday (no leading days)", () => {
    // 2026-02-01 is a Sunday.
    const weeks = generateMonthGrid(2026, 2);
    expect(weeks[0][0].date).toEqual({ year: 2026, month: 2, day: 1 });
    expect(weeks[0][0].isCurrentMonth).toBe(true);
  });

  it("handles a leap-year February correctly (29 days)", () => {
    const weeks = generateMonthGrid(2024, 2);
    const currentMonthCells = weeks.flat().filter((c) => c.isCurrentMonth);
    expect(currentMonthCells).toHaveLength(29);
  });

  it("always produces a multiple of 7 total cells", () => {
    for (let month = 1; month <= 12; month++) {
      const weeks = generateMonthGrid(2026, month);
      expect(weeks.flat().length % 7).toBe(0);
    }
  });
});

describe("addMonthsToYearMonth", () => {
  it("steps forward within the same year", () => {
    expect(addMonthsToYearMonth({ year: 2026, month: 1 }, 1)).toEqual({ year: 2026, month: 2 });
  });

  it("rolls over into the next year", () => {
    expect(addMonthsToYearMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("steps backward across a year boundary", () => {
    expect(addMonthsToYearMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("handles a large multi-year jump", () => {
    expect(addMonthsToYearMonth({ year: 2026, month: 6 }, 30)).toEqual({ year: 2028, month: 12 });
  });
});

describe("firstDateOfMonth / lastDateOfMonth", () => {
  it("returns the 1st and last day of a 31-day month", () => {
    expect(firstDateOfMonth({ year: 2026, month: 1 })).toEqual({ year: 2026, month: 1, day: 1 });
    expect(lastDateOfMonth({ year: 2026, month: 1 })).toEqual({ year: 2026, month: 1, day: 31 });
  });

  it("returns the correct last day for February in a leap vs non-leap year", () => {
    expect(lastDateOfMonth({ year: 2024, month: 2 })).toEqual({ year: 2024, month: 2, day: 29 });
    expect(lastDateOfMonth({ year: 2026, month: 2 })).toEqual({ year: 2026, month: 2, day: 28 });
  });
});
