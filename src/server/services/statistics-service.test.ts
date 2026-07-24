import { describe, expect, it, vi, beforeEach } from "vitest";
import { BannerFamily } from "@/config/gacha";
import { CurrencyType, IncomeSource, TransactionType } from "@/lib/calendar-math";

const mockGetMergedOccurrences = vi.fn();
const mockListActualOccurrencesInRange = vi.fn();

vi.mock("./calendar-occurrence-service", () => ({
  getMergedOccurrences: (...args: unknown[]) => mockGetMergedOccurrences(...args),
}));
vi.mock("@/server/repositories/calendar-transaction-repository", () => ({
  listActualOccurrencesInRange: (...args: unknown[]) => mockListActualOccurrencesInRange(...args),
}));

import { getStatisticsOverview } from "./statistics-service";

function d(year: number, month: number, day: number) {
  return { year, month, day };
}

const TODAY = d(2026, 1, 15);
const RANGE_START = d(2026, 1, 10);
const RANGE_END = d(2026, 1, 20);

describe("getStatisticsOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMergedOccurrences.mockResolvedValue([]);
    mockListActualOccurrencesInRange.mockResolvedValue([]);
  });

  it("returns the requested range and today in the response shape", async () => {
    const result = await getStatisticsOverview("user-1", TODAY, RANGE_START, RANGE_END);
    expect(result.range).toEqual({ from: RANGE_START, to: RANGE_END, today: TODAY });
  });

  it("computes actual totals from listActualOccurrencesInRange, clamped to [rangeStart, today]", async () => {
    mockListActualOccurrencesInRange.mockResolvedValue([
      {
        id: "tx-1",
        userId: "user-1",
        localDate: d(2026, 1, 12),
        type: TransactionType.INCOME,
        currencyType: CurrencyType.POLYCHROME,
        amount: 300,
        source: IncomeSource.EVENT,
        bannerFamily: null,
        note: null,
        seriesId: null,
        occurrenceDate: null,
        version: 1,
      },
    ]);

    const result = await getStatisticsOverview("user-1", TODAY, RANGE_START, RANGE_END);

    expect(mockListActualOccurrencesInRange).toHaveBeenCalledWith("user-1", RANGE_START, TODAY);
    expect(result.actual.incomeTotals).toEqual([{ currency: CurrencyType.POLYCHROME, amount: 300 }]);
    expect(result.actual.netFlowPolychrome).toBe(300);
  });

  it("does not call listActualOccurrencesInRange when the whole range is in the future", async () => {
    const futureStart = d(2026, 2, 1);
    const futureEnd = d(2026, 2, 10);
    await getStatisticsOverview("user-1", TODAY, futureStart, futureEnd);
    expect(mockListActualOccurrencesInRange).not.toHaveBeenCalled();
  });

  it("computes scheduled totals from virtual occurrences dated strictly after today", async () => {
    mockGetMergedOccurrences.mockResolvedValue([
      {
        kind: "virtual",
        seriesId: "series-1",
        occurrenceDate: d(2026, 1, 16),
        type: TransactionType.INCOME,
        currencyType: CurrencyType.POLYCHROME,
        amount: 60,
        source: IncomeSource.DAILY,
        bannerFamily: null,
        note: null,
      },
      {
        // Dated ON today — excluded from "scheduled" (not "still ahead").
        kind: "virtual",
        seriesId: "series-1",
        occurrenceDate: TODAY,
        type: TransactionType.INCOME,
        currencyType: CurrencyType.POLYCHROME,
        amount: 60,
        source: IncomeSource.DAILY,
        bannerFamily: null,
        note: null,
      },
    ]);

    const result = await getStatisticsOverview("user-1", TODAY, RANGE_START, RANGE_END);
    expect(result.scheduled.incomeTotals).toEqual([{ currency: CurrencyType.POLYCHROME, amount: 60 }]);
  });

  it("expectedRangeTotal merges actual + scheduled per currency", async () => {
    mockListActualOccurrencesInRange.mockResolvedValue([
      {
        id: "tx-1",
        userId: "user-1",
        localDate: d(2026, 1, 12),
        type: TransactionType.INCOME,
        currencyType: CurrencyType.POLYCHROME,
        amount: 100,
        source: IncomeSource.EVENT,
        bannerFamily: null,
        note: null,
        seriesId: null,
        occurrenceDate: null,
        version: 1,
      },
    ]);
    mockGetMergedOccurrences.mockResolvedValue([
      {
        kind: "virtual",
        seriesId: "series-1",
        occurrenceDate: d(2026, 1, 16),
        type: TransactionType.INCOME,
        currencyType: CurrencyType.POLYCHROME,
        amount: 60,
        source: IncomeSource.DAILY,
        bannerFamily: null,
        note: null,
      },
    ]);

    const result = await getStatisticsOverview("user-1", TODAY, RANGE_START, RANGE_END);
    expect(result.expectedRangeTotal.income).toEqual([{ currency: CurrencyType.POLYCHROME, amount: 160 }]);
    expect(result.expectedRangeTotal.netFlowPolychrome).toBe(160);
  });

  it("breakdowns.bySource/byBannerFamily/byTransactionType are derived from actual-only data", async () => {
    mockListActualOccurrencesInRange.mockResolvedValue([
      {
        id: "tx-1",
        userId: "user-1",
        localDate: d(2026, 1, 12),
        type: TransactionType.PULL,
        currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE,
        amount: 1,
        source: null,
        bannerFamily: BannerFamily.EXCLUSIVE_AGENT,
        note: null,
        seriesId: null,
        occurrenceDate: null,
        version: 1,
      },
    ]);

    const result = await getStatisticsOverview("user-1", TODAY, RANGE_START, RANGE_END);
    expect(result.breakdowns.byBannerFamily).toEqual([
      { bannerFamily: BannerFamily.EXCLUSIVE_AGENT, currency: CurrencyType.ENCRYPTED_MASTER_TAPE, pulls: 1 },
    ]);
    expect(result.breakdowns.byTransactionType).toEqual([
      { type: TransactionType.PULL, currency: CurrencyType.ENCRYPTED_MASTER_TAPE, amount: 1 },
    ]);
  });

  it("produces a timeline covering the whole requested range", async () => {
    const result = await getStatisticsOverview("user-1", TODAY, RANGE_START, RANGE_END);
    expect(result.timeline).toHaveLength(11); // Jan 10 .. Jan 20 inclusive
  });
});
