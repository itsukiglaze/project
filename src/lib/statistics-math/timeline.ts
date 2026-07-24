import {
  calculateDailyBalances,
  compareLocalDate,
  CurrencyType,
  formatLocalDate,
  TransactionType,
  type BalanceLineItem,
  type LocalDate,
  type MergedOccurrence,
} from "@/lib/calendar-math";
import type { StatisticsTimelinePoint } from "./types";

function dateOf(occurrence: MergedOccurrence): LocalDate {
  return occurrence.kind === "actual" ? occurrence.localDate : occurrence.occurrenceDate;
}

type DayAccumulator = {
  actualIncome: number;
  actualExpense: number;
  actualPulls: number;
  scheduledIncome: number;
  scheduledExpense: number;
  scheduledPulls: number;
};

function emptyAccumulator(): DayAccumulator {
  return {
    actualIncome: 0,
    actualExpense: 0,
    actualPulls: 0,
    scheduledIncome: 0,
    scheduledExpense: 0,
    scheduledPulls: 0,
  };
}

/**
 * Builds the continuous actual-to-projected timeline for the given merged
 * occurrences over [rangeStart, rangeEnd].
 *
 * The cumulative net (income - expense) is computed ONCE, over a SINGLE
 * Polychrome-filtered pass across the whole range via the existing
 * calculateDailyBalances — this guarantees the projected line continues
 * exactly from the actual line's last value, rather than being two
 * independently-anchored series. `today`'s point gets BOTH
 * actualCumulativeNetPolychrome and projectedCumulativeNetPolychrome set to
 * the same value — the visual hand-off point from solid to dashed.
 *
 * The cumulative net is relative (starts at 0), NOT anchored to the
 * user's real Polychrome wallet balance — see StatisticsBucketTotals'
 * own docs for why.
 *
 * PULL is represented only as a per-day COUNT (any pull-currency), never
 * folded into the Polychrome net line.
 */
export function buildStatisticsTimeline(params: {
  occurrences: MergedOccurrence[];
  today: LocalDate;
  rangeStart: LocalDate;
  rangeEnd: LocalDate;
}): StatisticsTimelinePoint[] {
  const { occurrences, today, rangeStart, rangeEnd } = params;

  const polychromeLineItems: BalanceLineItem[] = occurrences
    .filter((o) => o.type !== TransactionType.PULL && o.currencyType === CurrencyType.POLYCHROME)
    .map((o) => ({ localDate: dateOf(o), type: o.type, amount: o.amount }));

  const cumulative = calculateDailyBalances(polychromeLineItems, 0, rangeStart, rangeEnd);

  const byDate = new Map<string, DayAccumulator>();
  function accumulatorFor(dateKey: string): DayAccumulator {
    let entry = byDate.get(dateKey);
    if (!entry) {
      entry = emptyAccumulator();
      byDate.set(dateKey, entry);
    }
    return entry;
  }

  for (const o of occurrences) {
    const entry = accumulatorFor(formatLocalDate(dateOf(o)));
    const isPolychrome = o.currencyType === CurrencyType.POLYCHROME;

    if (o.kind === "actual") {
      if (o.type === TransactionType.PULL) {
        entry.actualPulls += 1;
      } else if (isPolychrome && o.type === TransactionType.INCOME) {
        entry.actualIncome += o.amount;
      } else if (isPolychrome && o.type === TransactionType.EXPENSE) {
        entry.actualExpense += o.amount;
      }
    } else {
      // Virtual occurrences are always INCOME/EXPENSE — PULL is not
      // recurring-eligible (see calendar-math/transaction-validation.ts),
      // so entry.scheduledPulls stays 0 here by construction.
      if (isPolychrome && o.type === TransactionType.INCOME) {
        entry.scheduledIncome += o.amount;
      } else if (isPolychrome && o.type === TransactionType.EXPENSE) {
        entry.scheduledExpense += o.amount;
      }
    }
  }

  return cumulative.map((point) => {
    const entry = byDate.get(formatLocalDate(point.date)) ?? emptyAccumulator();
    const cmp = compareLocalDate(point.date, today);

    return {
      date: point.date,
      actualIncomePolychrome: entry.actualIncome,
      actualExpensePolychrome: entry.actualExpense,
      actualPulls: entry.actualPulls,
      actualCumulativeNetPolychrome: cmp <= 0 ? point.runningBalance : null,
      scheduledIncomePolychrome: entry.scheduledIncome,
      scheduledExpensePolychrome: entry.scheduledExpense,
      scheduledPulls: entry.scheduledPulls,
      projectedCumulativeNetPolychrome: cmp >= 0 ? point.runningBalance : null,
    };
  });
}
