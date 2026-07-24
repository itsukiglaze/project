import { addDays, compareLocalDate, daysInMonth, getDayOfWeek, type LocalDate } from "@/lib/calendar-math";

export type MonthGridCell = {
  date: LocalDate;
  isCurrentMonth: boolean;
};

export type YearMonth = { year: number; month: number };

/**
 * Generates a full grid of complete weeks (Sunday-first) covering the
 * given month, including leading days from the previous month and
 * trailing days from the next month so every row has exactly 7 cells.
 * Pure — no JS `Date`, no React.
 */
export function generateMonthGrid(year: number, month: number): MonthGridCell[][] {
  const firstOfMonth: LocalDate = { year, month, day: 1 };
  const firstDow = getDayOfWeek(firstOfMonth);
  const gridStart = addDays(firstOfMonth, -firstDow);

  const lastOfMonth: LocalDate = { year, month, day: daysInMonth(year, month) };
  const lastDow = getDayOfWeek(lastOfMonth);
  const trailingDays = 6 - lastDow;
  const gridEnd = addDays(lastOfMonth, trailingDays);

  const cells: MonthGridCell[] = [];
  let cursor = gridStart;
  while (compareLocalDate(cursor, gridEnd) <= 0) {
    cells.push({ date: cursor, isCurrentMonth: cursor.month === month && cursor.year === year });
    cursor = addDays(cursor, 1);
  }

  const weeks: MonthGridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/** Steps a {year, month} pair forward/backward by `delta` months, wrapping the year. */
export function addMonthsToYearMonth(yearMonth: YearMonth, delta: number): YearMonth {
  const total = yearMonth.month - 1 + delta;
  const year = yearMonth.year + Math.floor(total / 12);
  const month = (((total % 12) + 12) % 12) + 1;
  return { year, month };
}

export function firstDateOfMonth(yearMonth: YearMonth): LocalDate {
  return { year: yearMonth.year, month: yearMonth.month, day: 1 };
}

export function lastDateOfMonth(yearMonth: YearMonth): LocalDate {
  return {
    year: yearMonth.year,
    month: yearMonth.month,
    day: daysInMonth(yearMonth.year, yearMonth.month),
  };
}
