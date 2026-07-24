import type { BannerFamily } from "@/config/gacha";
import { CurrencyType, TransactionType, type IncomeSource } from "@/lib/calendar-math";
import type {
  BannerPullCount,
  CurrencyAmount,
  SourceCurrencyAmount,
  StatisticsBucketTotals,
  TransactionTypeCurrencyAmount,
} from "./types";

/** Minimal shape needed to group a money-moving item by (type, currency). */
export type MoneyItem = {
  type: TransactionType;
  currencyType: CurrencyType | null;
  amount: number;
};

/** Minimal shape needed to group an INCOME item by (source, currency). */
export type SourceItem = {
  source: IncomeSource | null;
  currencyType: CurrencyType | null;
  amount: number;
};

/** Minimal shape needed to count a PULL item by (bannerFamily, currency). */
export type BannerPullItem = {
  bannerFamily: BannerFamily | null;
  currencyType: CurrencyType | null;
};

/**
 * Sums `items` of the given `type`, grouped by currency — never blending
 * currencies together. Items with a null `currencyType` are skipped
 * (existing validation — see calendar-math/transaction-validation.ts —
 * already requires currencyType for every real INCOME/EXPENSE/PULL row,
 * so this should never trigger in practice; it's a defensive guard, not a
 * silently-wrong fallback).
 */
export function sumByCurrency(items: MoneyItem[], type: TransactionType): CurrencyAmount[] {
  const totals = new Map<CurrencyType, number>();
  for (const item of items) {
    if (item.type !== type || item.currencyType === null) continue;
    totals.set(item.currencyType, (totals.get(item.currencyType) ?? 0) + item.amount);
  }
  return Array.from(totals.entries()).map(([currency, amount]) => ({ currency, amount }));
}

/** Counts PULL items, grouped by banner family (each family has exactly one pull currency). */
export function countPullsByBannerFamily(items: BannerPullItem[]): BannerPullCount[] {
  const totals = new Map<BannerFamily, { currency: CurrencyType; pulls: number }>();
  for (const item of items) {
    if (item.bannerFamily === null || item.currencyType === null) continue;
    const existing = totals.get(item.bannerFamily);
    if (existing) {
      existing.pulls += 1;
    } else {
      totals.set(item.bannerFamily, { currency: item.currencyType, pulls: 1 });
    }
  }
  return Array.from(totals.entries()).map(([bannerFamily, v]) => ({
    bannerFamily,
    currency: v.currency,
    pulls: v.pulls,
  }));
}

/** Sums INCOME items, grouped by (source, currency) — never blending currencies. */
export function sumBySource(items: SourceItem[]): SourceCurrencyAmount[] {
  const totals = new Map<string, SourceCurrencyAmount>();
  for (const item of items) {
    if (item.source === null || item.currencyType === null) continue;
    const key = `${item.source}:${item.currencyType}`;
    const existing = totals.get(key);
    if (existing) {
      existing.amount += item.amount;
    } else {
      totals.set(key, { source: item.source, currency: item.currencyType, amount: item.amount });
    }
  }
  return Array.from(totals.values());
}

/** Sums all items, grouped by (transaction type, currency) — never blending currencies. */
export function sumByTransactionType(items: MoneyItem[]): TransactionTypeCurrencyAmount[] {
  const totals = new Map<string, TransactionTypeCurrencyAmount>();
  for (const item of items) {
    if (item.currencyType === null) continue;
    const key = `${item.type}:${item.currencyType}`;
    const existing = totals.get(key);
    if (existing) {
      existing.amount += item.amount;
    } else {
      totals.set(key, { type: item.type, currency: item.currencyType, amount: item.amount });
    }
  }
  return Array.from(totals.values());
}

/** Merges two currency-grouped total lists, summing matching currencies. */
export function mergeCurrencyTotals(a: CurrencyAmount[], b: CurrencyAmount[]): CurrencyAmount[] {
  const totals = new Map<CurrencyType, number>();
  for (const { currency, amount } of [...a, ...b]) {
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }
  return Array.from(totals.entries()).map(([currency, amount]) => ({ currency, amount }));
}

/** Merges two banner-pull-count lists, summing matching (bannerFamily, currency) pairs. */
export function mergePullCounts(a: BannerPullCount[], b: BannerPullCount[]): BannerPullCount[] {
  const totals = new Map<BannerFamily, { currency: CurrencyType; pulls: number }>();
  for (const { bannerFamily, currency, pulls } of [...a, ...b]) {
    const existing = totals.get(bannerFamily);
    if (existing) {
      existing.pulls += pulls;
    } else {
      totals.set(bannerFamily, { currency, pulls });
    }
  }
  return Array.from(totals.entries()).map(([bannerFamily, v]) => ({
    bannerFamily,
    currency: v.currency,
    pulls: v.pulls,
  }));
}

/**
 * Polychrome-only net (income - expense). PULL never contributes — see
 * StatisticsBucketTotals.netFlowPolychrome's own docs.
 */
function netFlowPolychromeFromTotals(incomeTotals: CurrencyAmount[], expenseTotals: CurrencyAmount[]): number {
  const income = incomeTotals.find((c) => c.currency === CurrencyType.POLYCHROME)?.amount ?? 0;
  const expense = expenseTotals.find((c) => c.currency === CurrencyType.POLYCHROME)?.amount ?? 0;
  return income - expense;
}

/**
 * Composes the currency-grouped income/expense totals, the pull counts,
 * and the Polychrome-only net into one bucket's full totals — the shape
 * shared by `actual` and `scheduled` in the statistics overview response.
 */
export function computeBucketTotals(items: (MoneyItem & SourceItem & BannerPullItem)[]): StatisticsBucketTotals {
  const incomeTotals = sumByCurrency(items, TransactionType.INCOME);
  const expenseTotals = sumByCurrency(items, TransactionType.EXPENSE);
  const pullTotals = countPullsByBannerFamily(items.filter((i) => i.type === TransactionType.PULL));

  return {
    incomeTotals,
    expenseTotals,
    pullTotals,
    netFlowPolychrome: netFlowPolychromeFromTotals(incomeTotals, expenseTotals),
  };
}
