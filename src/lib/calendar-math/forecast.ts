import { addDays, type LocalDate } from "./local-date";
import { expandRecurrence, type RecurrenceRule } from "./recurrence";
import { applyExceptions, type SeriesException, type VirtualOccurrence } from "./exceptions";
import { mergeActualAndVirtual, type ActualOccurrence, type MergedOccurrence } from "./merge";
import { calculateDailyBalances, type DailyBalancePoint } from "./balance";
import type { SeriesTemplate } from "./transaction-validation";

/**
 * Hard cap on how far ahead a forecast can look, regardless of what's
 * requested — Stage 5 is explicitly "basic bounded calendar forecast"
 * only; trends/averages/analytics are Stage 6. A `NEVER`-ending series
 * must never cause an unbounded computation.
 */
export const MAX_FORECAST_HORIZON_DAYS = 90;

export type ActiveSeriesInput = {
  seriesId: string;
  isActive: boolean;
  rule: RecurrenceRule;
  template: SeriesTemplate;
  exceptions: SeriesException[];
};

export type ForecastResult = {
  requestedHorizonDays: number;
  /** The horizon actually used, after clamping to MAX_FORECAST_HORIZON_DAYS (and to >= 0). */
  effectiveHorizonDays: number;
  rangeStart: LocalDate;
  rangeEnd: LocalDate;
  occurrences: MergedOccurrence[];
  dailyBalances: DailyBalancePoint[];
  projectedEndingBalance: number;
};

export type CalculateBoundedForecastParams = {
  today: LocalDate;
  requestedHorizonDays: number;
  startingBalance: number;
  series: ActiveSeriesInput[];
  /** Already-recorded transactions whose localDate/occurrenceDate fall within the forecast window. */
  actualTransactions: ActualOccurrence[];
};

/**
 * Expands every active series' recurrence rule over a bounded window
 * starting today, applies per-occurrence exceptions, merges with
 * already-recorded actual transactions (deduplicating materialized
 * occurrences), and projects a running balance across the window.
 *
 * Read-only and side-effect free — never materializes anything, never
 * writes. Inactive (soft-deleted) series are skipped entirely.
 */
export function calculateBoundedForecast(params: CalculateBoundedForecastParams): ForecastResult {
  const effectiveHorizonDays = Math.max(
    0,
    Math.min(params.requestedHorizonDays, MAX_FORECAST_HORIZON_DAYS),
  );
  const rangeStart = params.today;
  const rangeEnd = addDays(params.today, effectiveHorizonDays);

  const allVirtual: VirtualOccurrence[] = [];
  for (const s of params.series) {
    if (!s.isActive) continue;
    const rawDates = expandRecurrence(s.rule, rangeStart, rangeEnd);
    allVirtual.push(...applyExceptions(s.seriesId, s.template, rawDates, s.exceptions));
  }

  const merged = mergeActualAndVirtual(params.actualTransactions, allVirtual);

  const dailyBalances = calculateDailyBalances(
    merged.map((m) => ({
      localDate: m.kind === "actual" ? m.localDate : m.occurrenceDate,
      type: m.type,
      amount: m.amount,
    })),
    params.startingBalance,
    rangeStart,
    rangeEnd,
  );

  const projectedEndingBalance =
    dailyBalances.length > 0
      ? dailyBalances[dailyBalances.length - 1].runningBalance
      : params.startingBalance;

  return {
    requestedHorizonDays: params.requestedHorizonDays,
    effectiveHorizonDays,
    rangeStart,
    rangeEnd,
    occurrences: merged,
    dailyBalances,
    projectedEndingBalance,
  };
}
