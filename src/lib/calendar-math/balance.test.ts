import { describe, expect, it } from "vitest";
import { calculateDailyBalances, type BalanceLineItem } from "./balance";
import type { LocalDate } from "./local-date";
import { TransactionType } from "./types";

function d(year: number, month: number, day: number): LocalDate {
  return { year, month, day };
}

describe("calculateDailyBalances", () => {
  it("carries the running balance forward on days with no transactions", () => {
    const result = calculateDailyBalances([], 100, d(2026, 1, 1), d(2026, 1, 3));
    expect(result).toEqual([
      { date: d(2026, 1, 1), netChange: 0, runningBalance: 100 },
      { date: d(2026, 1, 2), netChange: 0, runningBalance: 100 },
      { date: d(2026, 1, 3), netChange: 0, runningBalance: 100 },
    ]);
  });

  it("INCOME adds to the running balance", () => {
    const items: BalanceLineItem[] = [{ localDate: d(2026, 1, 2), type: TransactionType.INCOME, amount: 60 }];
    const result = calculateDailyBalances(items, 100, d(2026, 1, 1), d(2026, 1, 3));
    expect(result[1]).toEqual({ date: d(2026, 1, 2), netChange: 60, runningBalance: 160 });
    expect(result[2].runningBalance).toBe(160); // carries forward
  });

  it("EXPENSE subtracts from the running balance", () => {
    const items: BalanceLineItem[] = [{ localDate: d(2026, 1, 2), type: TransactionType.EXPENSE, amount: 40 }];
    const result = calculateDailyBalances(items, 100, d(2026, 1, 1), d(2026, 1, 3));
    expect(result[1].runningBalance).toBe(60);
  });

  it("PULL also subtracts (currency consumption), same as EXPENSE", () => {
    const items: BalanceLineItem[] = [{ localDate: d(2026, 1, 2), type: TransactionType.PULL, amount: 160 }];
    const result = calculateDailyBalances(items, 200, d(2026, 1, 1), d(2026, 1, 3));
    expect(result[1].runningBalance).toBe(40);
  });

  it("sums multiple transactions on the same day into one net change", () => {
    const items: BalanceLineItem[] = [
      { localDate: d(2026, 1, 1), type: TransactionType.INCOME, amount: 60 },
      { localDate: d(2026, 1, 1), type: TransactionType.INCOME, amount: 300 },
      { localDate: d(2026, 1, 1), type: TransactionType.EXPENSE, amount: 160 },
    ];
    const result = calculateDailyBalances(items, 0, d(2026, 1, 1), d(2026, 1, 1));
    expect(result[0]).toEqual({ date: d(2026, 1, 1), netChange: 200, runningBalance: 200 });
  });

  it("ignores a transaction outside the requested range", () => {
    const items: BalanceLineItem[] = [{ localDate: d(2026, 2, 1), type: TransactionType.INCOME, amount: 60 }];
    const result = calculateDailyBalances(items, 100, d(2026, 1, 1), d(2026, 1, 3));
    expect(result.every((p) => p.runningBalance === 100)).toBe(true);
  });

  it("returns [] when rangeEnd is before rangeStart", () => {
    expect(calculateDailyBalances([], 100, d(2026, 1, 5), d(2026, 1, 1))).toEqual([]);
  });

  it("produces exactly one point for a single-day range", () => {
    const result = calculateDailyBalances([], 50, d(2026, 1, 1), d(2026, 1, 1));
    expect(result).toHaveLength(1);
  });
});
