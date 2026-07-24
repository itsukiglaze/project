import { describe, expect, it, vi } from "vitest";
import {
  MAX_FORECAST_HORIZON_DAYS,
  RecurrenceEndType,
  RecurrenceFrequency,
  TransactionType,
  CurrencyType,
  IncomeSource,
} from "@/lib/calendar-math";

const mockListActiveSeriesForUser = vi.fn();
const mockListExceptionsForSeriesIds = vi.fn();
const mockListActualOccurrencesInRange = vi.fn();

vi.mock("@/server/repositories/calendar-event-series-repository", () => ({
  listActiveSeriesForUser: (...args: unknown[]) => mockListActiveSeriesForUser(...args),
}));

vi.mock("@/server/repositories/calendar-event-exception-repository", () => ({
  listExceptionsForSeriesIds: (...args: unknown[]) => mockListExceptionsForSeriesIds(...args),
}));

vi.mock("@/server/repositories/calendar-transaction-repository", () => ({
  listActualOccurrencesInRange: (...args: unknown[]) => mockListActualOccurrencesInRange(...args),
  toActualOccurrence: (record: unknown) => record,
}));

import { getBoundedForecast } from "./calendar-forecast-service";

function d(year: number, month: number, day: number) {
  return { year, month, day };
}

function dailySeries(overrides: Record<string, unknown> = {}) {
  return {
    id: "series-1",
    userId: "user-1",
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 60,
    source: IncomeSource.DAILY,
    bannerFamily: null,
    note: null,
    timezone: "Europe/Berlin",
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
    isActive: true,
    splitFromSeriesId: null,
    version: 1,
    ...overrides,
  };
}

describe("getBoundedForecast", () => {
  it("clamps the requested horizon and only fetches actual transactions within the clamped window", async () => {
    mockListActiveSeriesForUser.mockResolvedValue([]);
    mockListExceptionsForSeriesIds.mockResolvedValue([]);
    mockListActualOccurrencesInRange.mockResolvedValue([]);

    const result = await getBoundedForecast("user-1", d(2026, 1, 1), 10_000, 0);

    expect(result.effectiveHorizonDays).toBe(MAX_FORECAST_HORIZON_DAYS);
    const [, , rangeEnd] = mockListActualOccurrencesInRange.mock.calls[0];
    expect(rangeEnd).toEqual({ year: 2026, month: 4, day: 1 }); // Jan 1 + 90 days = Apr 1 2026
  });

  it("projects a running balance from an active daily-income series", async () => {
    mockListActiveSeriesForUser.mockResolvedValue([dailySeries()]);
    mockListExceptionsForSeriesIds.mockResolvedValue([]);
    mockListActualOccurrencesInRange.mockResolvedValue([]);

    const result = await getBoundedForecast("user-1", d(2026, 1, 1), 4, 0);
    expect(result.projectedEndingBalance).toBe(5 * 60); // Jan 1-5 inclusive
  });

  it("passes the loaded exceptions through, grouped per series", async () => {
    mockListActiveSeriesForUser.mockResolvedValue([dailySeries()]);
    mockListExceptionsForSeriesIds.mockResolvedValue([
      {
        seriesId: "series-1",
        occurrenceDate: d(2026, 1, 3),
        isCancelled: true,
        amountOverride: null,
        currencyTypeOverride: null,
        sourceOverride: null,
        bannerFamilyOverride: null,
        noteOverride: null,
        version: 1,
      },
    ]);
    mockListActualOccurrencesInRange.mockResolvedValue([]);

    const result = await getBoundedForecast("user-1", d(2026, 1, 1), 4, 0);
    expect(result.occurrences).toHaveLength(4); // 5 days minus the cancelled one
    expect(result.projectedEndingBalance).toBe(4 * 60);
  });

  it("returns the starting balance unchanged with no active series and no actual transactions", async () => {
    mockListActiveSeriesForUser.mockResolvedValue([]);
    mockListExceptionsForSeriesIds.mockResolvedValue([]);
    mockListActualOccurrencesInRange.mockResolvedValue([]);

    const result = await getBoundedForecast("user-1", d(2026, 1, 1), 30, 500);
    expect(result.projectedEndingBalance).toBe(500);
  });
});
