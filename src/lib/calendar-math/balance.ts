import { addDays, compareLocalDate, formatLocalDate, type LocalDate } from "./local-date";
import { TransactionType } from "./types";

export type BalanceLineItem = {
  localDate: LocalDate;
  type: TransactionType;
  /** Always a positive magnitude — direction comes from `type`. */
  amount: number;
};

export type DailyBalancePoint = {
  date: LocalDate;
  /** Signed net change on this day (positive or negative). */
  netChange: number;
  /** Running total including this day's net change. */
  runningBalance: number;
};

/** Safety backstop against an absurdly large range being requested. */
export const MAX_DAILY_BALANCE_DAYS = 3660; // ~10 years

/** INCOME adds to the balance; EXPENSE and PULL both consume from it. */
function signedAmount(item: BalanceLineItem): number {
  return item.type === TransactionType.INCOME ? item.amount : -item.amount;
}

/**
 * Produces one point per calendar day in [rangeStart, rangeEnd]
 * (inclusive), even for days with no transactions — the running balance
 * simply carries over unchanged on those days. This is plain historical
 * bookkeeping over ACTUAL line items; forecasting virtual occurrences is
 * a separate concern (see forecast.ts), which calls this after merging.
 */
export function calculateDailyBalances(
  items: BalanceLineItem[],
  startingBalance: number,
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
): DailyBalancePoint[] {
  if (compareLocalDate(rangeEnd, rangeStart) < 0) return [];

  const netByDate = new Map<string, number>();
  for (const item of items) {
    const key = formatLocalDate(item.localDate);
    netByDate.set(key, (netByDate.get(key) ?? 0) + signedAmount(item));
  }

  const points: DailyBalancePoint[] = [];
  let running = startingBalance;
  let cursor = rangeStart;
  let guard = 0;

  while (compareLocalDate(cursor, rangeEnd) <= 0 && guard < MAX_DAILY_BALANCE_DAYS) {
    guard += 1;
    const net = netByDate.get(formatLocalDate(cursor)) ?? 0;
    running += net;
    points.push({ date: cursor, netChange: net, runningBalance: running });
    cursor = addDays(cursor, 1);
  }

  return points;
}
