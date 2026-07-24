import { describe, expect, it, vi } from "vitest";
import { RecurrenceEndType, RecurrenceFrequency, TransactionType, CurrencyType, IncomeSource } from "@/lib/calendar-math";

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

import { getMergedOccurrences } from "./calendar-occurrence-service";

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

describe("getMergedOccurrences", () => {
  it("expands active series and returns virtual occurrences within range", async () => {
    mockListActiveSeriesForUser.mockResolvedValue([dailySeries()]);
    mockListExceptionsForSeriesIds.mockResolvedValue([]);
    mockListActualOccurrencesInRange.mockResolvedValue([]);

    const result = await getMergedOccurrences("user-1", d(2026, 1, 1), d(2026, 1, 3));
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.kind === "virtual")).toBe(true);
  });

  it("suppresses a virtual occurrence already materialized as an actual transaction", async () => {
    mockListActiveSeriesForUser.mockResolvedValue([dailySeries()]);
    mockListExceptionsForSeriesIds.mockResolvedValue([]);
    mockListActualOccurrencesInRange.mockResolvedValue([
      {
        seriesId: "series-1",
        occurrenceDate: d(2026, 1, 2),
        localDate: d(2026, 1, 2),
        type: TransactionType.INCOME,
        currencyType: CurrencyType.POLYCHROME,
        amount: 60,
      },
    ]);

    const result = await getMergedOccurrences("user-1", d(2026, 1, 1), d(2026, 1, 3));
    expect(result).toHaveLength(3); // still 3, not 4
    const jan2 = result.find(
      (r) => (r.kind === "actual" ? r.localDate : r.occurrenceDate).day === 2,
    );
    expect(jan2?.kind).toBe("actual");
  });

  it("applies a per-occurrence exception (cancellation)", async () => {
    mockListActiveSeriesForUser.mockResolvedValue([dailySeries()]);
    mockListExceptionsForSeriesIds.mockResolvedValue([
      {
        seriesId: "series-1",
        occurrenceDate: d(2026, 1, 2),
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

    const result = await getMergedOccurrences("user-1", d(2026, 1, 1), d(2026, 1, 3));
    expect(result).toHaveLength(2); // Jan 2 cancelled
  });

  it("never expands an inactive series (soft-deleted series are pre-filtered by the repository)", async () => {
    mockListActiveSeriesForUser.mockResolvedValue([]); // repository already only returns isActive=true
    mockListExceptionsForSeriesIds.mockResolvedValue([]);
    mockListActualOccurrencesInRange.mockResolvedValue([]);

    const result = await getMergedOccurrences("user-1", d(2026, 1, 1), d(2026, 1, 3));
    expect(result).toEqual([]);
  });

  it("includes a one-time actual transaction unrelated to any series", async () => {
    mockListActiveSeriesForUser.mockResolvedValue([]);
    mockListExceptionsForSeriesIds.mockResolvedValue([]);
    mockListActualOccurrencesInRange.mockResolvedValue([
      {
        seriesId: null,
        occurrenceDate: null,
        localDate: d(2026, 1, 2),
        type: TransactionType.EXPENSE,
        currencyType: CurrencyType.POLYCHROME,
        amount: 40,
      },
    ]);

    const result = await getMergedOccurrences("user-1", d(2026, 1, 1), d(2026, 1, 3));
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("actual");
  });
});
