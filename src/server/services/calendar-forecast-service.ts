import "server-only";
import {
  addDays,
  calculateBoundedForecast,
  MAX_FORECAST_HORIZON_DAYS,
  type ActiveSeriesInput,
  type ForecastResult,
  type LocalDate,
} from "@/lib/calendar-math";
import { listActiveSeriesForUser } from "@/server/repositories/calendar-event-series-repository";
import { listExceptionsForSeriesIds } from "@/server/repositories/calendar-event-exception-repository";
import {
  listActualOccurrencesInRange,
  toActualOccurrence,
} from "@/server/repositories/calendar-transaction-repository";

/**
 * Read-only. Loads the user's active series (+ rules/templates/exceptions)
 * and actual transactions already recorded within the (clamped) forecast
 * window, then delegates all arithmetic to the pure
 * calculateBoundedForecast — this service never writes anything.
 */
export async function getBoundedForecast(
  userId: string,
  today: LocalDate,
  requestedHorizonDays: number,
  startingBalance: number,
): Promise<ForecastResult> {
  const effectiveHorizonDays = Math.max(0, Math.min(requestedHorizonDays, MAX_FORECAST_HORIZON_DAYS));
  const rangeEnd = addDays(today, effectiveHorizonDays);

  const series = await listActiveSeriesForUser(userId);
  const exceptions = await listExceptionsForSeriesIds(series.map((s) => s.id));
  const exceptionsBySeriesId = new Map<string, typeof exceptions>();
  for (const exception of exceptions) {
    const list = exceptionsBySeriesId.get(exception.seriesId) ?? [];
    list.push(exception);
    exceptionsBySeriesId.set(exception.seriesId, list);
  }

  const activeSeriesInputs: ActiveSeriesInput[] = series.map((s) => ({
    seriesId: s.id,
    isActive: s.isActive,
    rule: s.rule,
    template: {
      type: s.type,
      currencyType: s.currencyType,
      amount: s.amount,
      source: s.source,
      bannerFamily: s.bannerFamily,
      note: s.note,
    },
    exceptions: exceptionsBySeriesId.get(s.id) ?? [],
  }));

  const actualRows = await listActualOccurrencesInRange(userId, today, rangeEnd);
  const actualTransactions = actualRows.map(toActualOccurrence);

  return calculateBoundedForecast({
    today,
    requestedHorizonDays,
    startingBalance,
    series: activeSeriesInputs,
    actualTransactions,
  });
}
