import { describe, expect, it } from "vitest";
import { BannerFamily } from "@/config/gacha";
import { applyExceptions, type SeriesException } from "./exceptions";
import type { LocalDate } from "./local-date";
import type { SeriesTemplate } from "./transaction-validation";
import { CurrencyType, IncomeSource, TransactionType } from "./types";

function d(year: number, month: number, day: number): LocalDate {
  return { year, month, day };
}

const TEMPLATE: SeriesTemplate = {
  type: TransactionType.INCOME,
  currencyType: CurrencyType.POLYCHROME,
  amount: 60,
  source: IncomeSource.DAILY,
  bannerFamily: null,
  note: "daily login",
};

function exception(overrides: Partial<SeriesException>): SeriesException {
  return {
    occurrenceDate: d(2026, 1, 1),
    isCancelled: false,
    amountOverride: null,
    currencyTypeOverride: null,
    sourceOverride: null,
    bannerFamilyOverride: null,
    noteOverride: null,
    ...overrides,
  };
}

describe("applyExceptions", () => {
  it("returns the template unchanged for dates with no exception", () => {
    const dates = [d(2026, 1, 1), d(2026, 1, 2)];
    const result = applyExceptions("series-1", TEMPLATE, dates, []);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ amount: 60, note: "daily login", currencyType: CurrencyType.POLYCHROME });
  });

  it("cancels a specific occurrence entirely", () => {
    const dates = [d(2026, 1, 1), d(2026, 1, 2), d(2026, 1, 3)];
    const exceptions = [exception({ occurrenceDate: d(2026, 1, 2), isCancelled: true })];
    const result = applyExceptions("series-1", TEMPLATE, dates, exceptions);
    expect(result.map((r) => r.occurrenceDate)).toEqual([d(2026, 1, 1), d(2026, 1, 3)]);
  });

  it("overrides only the amount, leaving other fields from the template", () => {
    const dates = [d(2026, 1, 1)];
    const exceptions = [exception({ occurrenceDate: d(2026, 1, 1), amountOverride: 300 })];
    const result = applyExceptions("series-1", TEMPLATE, dates, exceptions);
    expect(result[0].amount).toBe(300);
    expect(result[0].note).toBe("daily login");
    expect(result[0].currencyType).toBe(CurrencyType.POLYCHROME);
  });

  it("overrides currencyType, source, bannerFamily, and note independently", () => {
    const dates = [d(2026, 1, 1)];
    const exceptions = [
      exception({
        occurrenceDate: d(2026, 1, 1),
        currencyTypeOverride: CurrencyType.MONOCHROME,
        sourceOverride: IncomeSource.EVENT,
        bannerFamilyOverride: BannerFamily.STABLE,
        noteOverride: "special event bonus",
      }),
    ];
    const result = applyExceptions("series-1", TEMPLATE, dates, exceptions);
    expect(result[0]).toMatchObject({
      currencyType: CurrencyType.MONOCHROME,
      source: IncomeSource.EVENT,
      bannerFamily: BannerFamily.STABLE,
      note: "special event bonus",
      amount: 60, // unaffected
    });
  });

  it("always carries the template's `type` — exceptions cannot change direction", () => {
    const dates = [d(2026, 1, 1)];
    const exceptions = [exception({ occurrenceDate: d(2026, 1, 1), amountOverride: 999 })];
    const result = applyExceptions("series-1", TEMPLATE, dates, exceptions);
    expect(result[0].type).toBe(TransactionType.INCOME);
  });

  it("tags every produced occurrence with the given seriesId", () => {
    const result = applyExceptions("series-xyz", TEMPLATE, [d(2026, 1, 1)], []);
    expect(result[0].seriesId).toBe("series-xyz");
  });

  it("an exception for a date NOT in occurrenceDates has no effect", () => {
    const dates = [d(2026, 1, 1)];
    const exceptions = [exception({ occurrenceDate: d(2026, 6, 15), isCancelled: true })];
    const result = applyExceptions("series-1", TEMPLATE, dates, exceptions);
    expect(result).toHaveLength(1);
  });
});
