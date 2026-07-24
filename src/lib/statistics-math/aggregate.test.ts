import { describe, expect, it } from "vitest";
import { BannerFamily } from "@/config/gacha";
import { CurrencyType, IncomeSource, TransactionType } from "@/lib/calendar-math";
import {
  computeBucketTotals,
  countPullsByBannerFamily,
  mergeCurrencyTotals,
  mergePullCounts,
  sumByCurrency,
  sumBySource,
  sumByTransactionType,
} from "./aggregate";

describe("sumByCurrency", () => {
  it("sums same-type same-currency amounts together", () => {
    const items = [
      { type: TransactionType.INCOME, currencyType: CurrencyType.POLYCHROME, amount: 100 },
      { type: TransactionType.INCOME, currencyType: CurrencyType.POLYCHROME, amount: 50 },
    ];
    expect(sumByCurrency(items, TransactionType.INCOME)).toEqual([
      { currency: CurrencyType.POLYCHROME, amount: 150 },
    ]);
  });

  it("keeps different currencies as separate entries, never summed together", () => {
    const items = [
      { type: TransactionType.EXPENSE, currencyType: CurrencyType.POLYCHROME, amount: 100 },
      { type: TransactionType.EXPENSE, currencyType: CurrencyType.MONOCHROME, amount: 30 },
    ];
    const result = sumByCurrency(items, TransactionType.EXPENSE);
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { currency: CurrencyType.POLYCHROME, amount: 100 },
        { currency: CurrencyType.MONOCHROME, amount: 30 },
      ]),
    );
  });

  it("ignores items of a different transaction type", () => {
    const items = [
      { type: TransactionType.INCOME, currencyType: CurrencyType.POLYCHROME, amount: 100 },
      { type: TransactionType.EXPENSE, currencyType: CurrencyType.POLYCHROME, amount: 40 },
    ];
    expect(sumByCurrency(items, TransactionType.INCOME)).toEqual([
      { currency: CurrencyType.POLYCHROME, amount: 100 },
    ]);
  });

  it("skips items with a null currencyType instead of crashing or mis-bucketing", () => {
    const items = [
      { type: TransactionType.INCOME, currencyType: null, amount: 100 },
      { type: TransactionType.INCOME, currencyType: CurrencyType.POLYCHROME, amount: 50 },
    ];
    expect(sumByCurrency(items, TransactionType.INCOME)).toEqual([
      { currency: CurrencyType.POLYCHROME, amount: 50 },
    ]);
  });

  it("returns an empty array for no matching items", () => {
    expect(sumByCurrency([], TransactionType.INCOME)).toEqual([]);
  });
});

describe("countPullsByBannerFamily", () => {
  it("counts pulls per family, keeping families separate", () => {
    const items = [
      { bannerFamily: BannerFamily.EXCLUSIVE_AGENT, currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE },
      { bannerFamily: BannerFamily.EXCLUSIVE_AGENT, currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE },
      { bannerFamily: BannerFamily.BANGBOO, currencyType: CurrencyType.BOOPON },
    ];
    const result = countPullsByBannerFamily(items);
    expect(result).toEqual(
      expect.arrayContaining([
        { bannerFamily: BannerFamily.EXCLUSIVE_AGENT, currency: CurrencyType.ENCRYPTED_MASTER_TAPE, pulls: 2 },
        { bannerFamily: BannerFamily.BANGBOO, currency: CurrencyType.BOOPON, pulls: 1 },
      ]),
    );
  });

  it("never lets Boopon pulls merge into another family's count", () => {
    const items = [
      { bannerFamily: BannerFamily.BANGBOO, currencyType: CurrencyType.BOOPON },
      { bannerFamily: BannerFamily.STABLE, currencyType: CurrencyType.MASTER_TAPE },
    ];
    const result = countPullsByBannerFamily(items);
    expect(result.find((r) => r.bannerFamily === BannerFamily.BANGBOO)).toEqual({
      bannerFamily: BannerFamily.BANGBOO,
      currency: CurrencyType.BOOPON,
      pulls: 1,
    });
  });

  it("skips items with a null bannerFamily or currencyType", () => {
    const items = [
      { bannerFamily: null, currencyType: CurrencyType.BOOPON },
      { bannerFamily: BannerFamily.BANGBOO, currencyType: null },
    ];
    expect(countPullsByBannerFamily(items)).toEqual([]);
  });
});

describe("sumBySource", () => {
  it("groups by (source, currency), never blending currencies within a source", () => {
    const items = [
      { source: IncomeSource.DAILY, currencyType: CurrencyType.POLYCHROME, amount: 60 },
      { source: IncomeSource.DAILY, currencyType: CurrencyType.MONOCHROME, amount: 10 },
      { source: IncomeSource.EVENT, currencyType: CurrencyType.POLYCHROME, amount: 300 },
    ];
    const result = sumBySource(items);
    expect(result).toHaveLength(3);
    expect(result).toEqual(
      expect.arrayContaining([
        { source: IncomeSource.DAILY, currency: CurrencyType.POLYCHROME, amount: 60 },
        { source: IncomeSource.DAILY, currency: CurrencyType.MONOCHROME, amount: 10 },
        { source: IncomeSource.EVENT, currency: CurrencyType.POLYCHROME, amount: 300 },
      ]),
    );
  });

  it("sums repeated (source, currency) pairs", () => {
    const items = [
      { source: IncomeSource.DAILY, currencyType: CurrencyType.POLYCHROME, amount: 60 },
      { source: IncomeSource.DAILY, currencyType: CurrencyType.POLYCHROME, amount: 60 },
    ];
    expect(sumBySource(items)).toEqual([{ source: IncomeSource.DAILY, currency: CurrencyType.POLYCHROME, amount: 120 }]);
  });
});

describe("sumByTransactionType", () => {
  it("groups by (type, currency)", () => {
    const items = [
      { type: TransactionType.INCOME, currencyType: CurrencyType.POLYCHROME, amount: 100 },
      { type: TransactionType.EXPENSE, currencyType: CurrencyType.POLYCHROME, amount: 40 },
      { type: TransactionType.EXPENSE, currencyType: CurrencyType.MONOCHROME, amount: 5 },
    ];
    const result = sumByTransactionType(items);
    expect(result).toEqual(
      expect.arrayContaining([
        { type: TransactionType.INCOME, currency: CurrencyType.POLYCHROME, amount: 100 },
        { type: TransactionType.EXPENSE, currency: CurrencyType.POLYCHROME, amount: 40 },
        { type: TransactionType.EXPENSE, currency: CurrencyType.MONOCHROME, amount: 5 },
      ]),
    );
  });
});

describe("mergeCurrencyTotals", () => {
  it("sums matching currencies from two lists", () => {
    const a = [{ currency: CurrencyType.POLYCHROME, amount: 100 }];
    const b = [{ currency: CurrencyType.POLYCHROME, amount: 50 }];
    expect(mergeCurrencyTotals(a, b)).toEqual([{ currency: CurrencyType.POLYCHROME, amount: 150 }]);
  });

  it("keeps non-matching currencies distinct instead of blending them", () => {
    const a = [{ currency: CurrencyType.POLYCHROME, amount: 100 }];
    const b = [{ currency: CurrencyType.BOOPON, amount: 5 }];
    const result = mergeCurrencyTotals(a, b);
    expect(result).toEqual(
      expect.arrayContaining([
        { currency: CurrencyType.POLYCHROME, amount: 100 },
        { currency: CurrencyType.BOOPON, amount: 5 },
      ]),
    );
  });
});

describe("mergePullCounts", () => {
  it("sums matching banner families' pull counts", () => {
    const a = [{ bannerFamily: BannerFamily.BANGBOO, currency: CurrencyType.BOOPON, pulls: 2 }];
    const b = [{ bannerFamily: BannerFamily.BANGBOO, currency: CurrencyType.BOOPON, pulls: 3 }];
    expect(mergePullCounts(a, b)).toEqual([{ bannerFamily: BannerFamily.BANGBOO, currency: CurrencyType.BOOPON, pulls: 5 }]);
  });
});

describe("computeBucketTotals", () => {
  it("composes income/expense/pull totals and a Polychrome-only net", () => {
    const items = [
      { type: TransactionType.INCOME, currencyType: CurrencyType.POLYCHROME, amount: 300, source: IncomeSource.EVENT, bannerFamily: null },
      { type: TransactionType.EXPENSE, currencyType: CurrencyType.POLYCHROME, amount: 100, source: null, bannerFamily: null },
      { type: TransactionType.PULL, currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE, amount: 1, source: null, bannerFamily: BannerFamily.EXCLUSIVE_AGENT },
    ];
    const result = computeBucketTotals(items);
    expect(result.incomeTotals).toEqual([{ currency: CurrencyType.POLYCHROME, amount: 300 }]);
    expect(result.expenseTotals).toEqual([{ currency: CurrencyType.POLYCHROME, amount: 100 }]);
    expect(result.pullTotals).toEqual([
      { bannerFamily: BannerFamily.EXCLUSIVE_AGENT, currency: CurrencyType.ENCRYPTED_MASTER_TAPE, pulls: 1 },
    ]);
    expect(result.netFlowPolychrome).toBe(200);
  });

  it("PULL never contributes to netFlowPolychrome, even if (hypothetically) currencyType were Polychrome", () => {
    const items = [
      { type: TransactionType.PULL, currencyType: CurrencyType.POLYCHROME, amount: 999, source: null, bannerFamily: BannerFamily.BANGBOO },
    ];
    const result = computeBucketTotals(items);
    expect(result.netFlowPolychrome).toBe(0);
  });

  it("netFlowPolychrome is 0 for an empty bucket", () => {
    expect(computeBucketTotals([]).netFlowPolychrome).toBe(0);
  });
});
