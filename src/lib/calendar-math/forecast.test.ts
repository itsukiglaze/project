import { describe, expect, it } from "vitest";
import {
  calculateBoundedForecast,
  MAX_FORECAST_HORIZON_DAYS,
  type ActiveSeriesInput,
} from "./forecast";
import type { LocalDate } from "./local-date";
import type { ActualOccurrence } from "./merge";
import { RecurrenceEndType, RecurrenceFrequency, TransactionType, CurrencyType, IncomeSource } from "./types";

function d(year: number, month: number, day: number): LocalDate {
  return { year, month, day };
}

function dailyIncomeSeries(overrides: Partial<ActiveSeriesInput> = {}): ActiveSeriesInput {
  return {
    seriesId: "series-1",
    isActive: true,
    rule: {
      frequency: RecurrenceFrequency.DAILY,
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: null,
      startDate: d(2026, 1, 1),
      endType: RecurrenceEndType.NEVER,
      endDate: null,
      occurrenceCount: null,
    },
    template: {
      type: TransactionType.INCOME,
      currencyType: CurrencyType.POLYCHROME,
      amount: 60,
      source: IncomeSource.DAILY,
      bannerFamily: null,
      note: null,
    },
    exceptions: [],
    ...overrides,
  };
}

describe("calculateBoundedForecast", () => {
  it("clamps the horizon to MAX_FORECAST_HORIZON_DAYS even if a larger value is requested", () => {
    const result = calculateBoundedForecast({
      today: d(2026, 1, 1),
      requestedHorizonDays: 10_000,
      startingBalance: 0,
      series: [],
      actualTransactions: [],
    });
    expect(result.requestedHorizonDays).toBe(10_000);
    expect(result.effectiveHorizonDays).toBe(MAX_FORECAST_HORIZON_DAYS);
  });

  it("clamps a negative requested horizon to 0", () => {
    const result = calculateBoundedForecast({
      today: d(2026, 1, 1),
      requestedHorizonDays: -5,
      startingBalance: 0,
      series: [],
      actualTransactions: [],
    });
    expect(result.effectiveHorizonDays).toBe(0);
    expect(result.rangeStart).toEqual(result.rangeEnd);
  });

  it("skips inactive (soft-deleted) series entirely", () => {
    const result = calculateBoundedForecast({
      today: d(2026, 1, 1),
      requestedHorizonDays: 5,
      startingBalance: 0,
      series: [dailyIncomeSeries({ isActive: false })],
      actualTransactions: [],
    });
    expect(result.occurrences).toEqual([]);
  });

  it("expands an active series and applies it to the running balance", () => {
    const result = calculateBoundedForecast({
      today: d(2026, 1, 1),
      requestedHorizonDays: 4,
      startingBalance: 0,
      series: [dailyIncomeSeries()],
      actualTransactions: [],
    });
    expect(result.occurrences).toHaveLength(5); // Jan 1-5 inclusive
    expect(result.projectedEndingBalance).toBe(5 * 60);
  });

  it("applies a cancellation exception within the forecast window", () => {
    const series = dailyIncomeSeries({
      exceptions: [
        {
          occurrenceDate: d(2026, 1, 3),
          isCancelled: true,
          amountOverride: null,
          currencyTypeOverride: null,
          sourceOverride: null,
          bannerFamilyOverride: null,
          noteOverride: null,
        },
      ],
    });
    const result = calculateBoundedForecast({
      today: d(2026, 1, 1),
      requestedHorizonDays: 4,
      startingBalance: 0,
      series: [series],
      actualTransactions: [],
    });
    expect(result.occurrences).toHaveLength(4); // one of the 5 days cancelled
    expect(result.projectedEndingBalance).toBe(4 * 60);
  });

  it("does not double-count a series occurrence that has already been materialized", () => {
    const actual: ActualOccurrence = {
      seriesId: "series-1",
      occurrenceDate: d(2026, 1, 2),
      localDate: d(2026, 1, 2),
      type: TransactionType.INCOME,
      currencyType: CurrencyType.POLYCHROME,
      amount: 60,
    };
    const result = calculateBoundedForecast({
      today: d(2026, 1, 1),
      requestedHorizonDays: 4,
      startingBalance: 0,
      series: [dailyIncomeSeries()],
      actualTransactions: [actual],
    });
    // Still 5 total occurrences (Jan 1-5), not 6 — the materialized Jan 2
    // replaces its virtual counterpart rather than adding to it.
    expect(result.occurrences).toHaveLength(5);
    expect(result.projectedEndingBalance).toBe(5 * 60);
  });

  it("includes a one-time actual transaction from an unrelated series in the balance", () => {
    const oneTime: ActualOccurrence = {
      seriesId: null,
      occurrenceDate: null,
      localDate: d(2026, 1, 1),
      type: TransactionType.EXPENSE,
      currencyType: CurrencyType.POLYCHROME,
      amount: 30,
    };
    const result = calculateBoundedForecast({
      today: d(2026, 1, 1),
      requestedHorizonDays: 0,
      startingBalance: 100,
      series: [],
      actualTransactions: [oneTime],
    });
    expect(result.projectedEndingBalance).toBe(70);
  });

  it("returns the starting balance unchanged when there is nothing to forecast", () => {
    const result = calculateBoundedForecast({
      today: d(2026, 1, 1),
      requestedHorizonDays: 30,
      startingBalance: 500,
      series: [],
      actualTransactions: [],
    });
    expect(result.projectedEndingBalance).toBe(500);
  });
});
