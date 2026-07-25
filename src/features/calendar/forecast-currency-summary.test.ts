import { describe, expect, it } from "vitest";
import { CurrencyType, IncomeSource, TransactionType } from "@/lib/calendar-math";
import { distinctCurrencies, summarizeIncomeByCurrency } from "./forecast-currency-summary";
import type { MergedOccurrenceDto } from "./api";

function virtual(overrides: Partial<Extract<MergedOccurrenceDto, { kind: "virtual" }>> = {}): MergedOccurrenceDto {
  return {
    kind: "virtual",
    seriesId: "series-1",
    occurrenceDate: "2026-01-05",
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 60,
    source: IncomeSource.DAILY,
    bannerFamily: null,
    note: null,
    ...overrides,
  };
}

describe("summarizeIncomeByCurrency", () => {
  it("sums INCOME occurrences of the same currency into one row", () => {
    const totals = summarizeIncomeByCurrency([virtual({ amount: 60 }), virtual({ amount: 90 })]);
    expect(totals).toEqual([{ currency: CurrencyType.POLYCHROME, total: 150 }]);
  });

  it("never merges different currencies into a single total — one row per currency", () => {
    const totals = summarizeIncomeByCurrency([
      virtual({ currencyType: CurrencyType.POLYCHROME, amount: 60 }),
      virtual({ currencyType: CurrencyType.BOOPON, amount: 5 }),
    ]);
    expect(totals).toContainEqual({ currency: CurrencyType.POLYCHROME, total: 60 });
    expect(totals).toContainEqual({ currency: CurrencyType.BOOPON, total: 5 });
    expect(totals).toHaveLength(2);
  });

  it("excludes EXPENSE occurrences from the income total", () => {
    const totals = summarizeIncomeByCurrency([
      virtual({ type: TransactionType.INCOME, amount: 60 }),
      virtual({ type: TransactionType.EXPENSE, amount: 200 }),
    ]);
    expect(totals).toEqual([{ currency: CurrencyType.POLYCHROME, total: 60 }]);
  });

  it("returns an empty array when there are no occurrences", () => {
    expect(summarizeIncomeByCurrency([])).toEqual([]);
  });
});

describe("distinctCurrencies", () => {
  it("returns each currency once even if it appears on multiple occurrences", () => {
    const currencies = distinctCurrencies([
      virtual({ currencyType: CurrencyType.POLYCHROME }),
      virtual({ currencyType: CurrencyType.POLYCHROME }),
    ]);
    expect(currencies).toEqual([CurrencyType.POLYCHROME]);
  });

  it("returns every distinct currency present", () => {
    const currencies = distinctCurrencies([
      virtual({ currencyType: CurrencyType.POLYCHROME }),
      virtual({ currencyType: CurrencyType.BOOPON }),
    ]);
    expect(currencies).toEqual(expect.arrayContaining([CurrencyType.POLYCHROME, CurrencyType.BOOPON]));
    expect(currencies).toHaveLength(2);
  });

  it("returns an empty array for no occurrences", () => {
    expect(distinctCurrencies([])).toEqual([]);
  });
});
