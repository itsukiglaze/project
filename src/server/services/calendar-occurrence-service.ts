import "server-only";
import {
  applyExceptions,
  expandRecurrence,
  mergeActualAndVirtual,
  type LocalDate,
  type MergedOccurrence,
  type VirtualOccurrence,
} from "@/lib/calendar-math";
import { listActiveSeriesForUser } from "@/server/repositories/calendar-event-series-repository";
import { listExceptionsForSeriesIds } from "@/server/repositories/calendar-event-exception-repository";
import {
  listActualOccurrencesInRange,
  toActualOccurrence,
} from "@/server/repositories/calendar-transaction-repository";

/**
 * Read-only: expands each of the user's ACTIVE series over [rangeStart,
 * rangeEnd], applies exceptions, and merges with already-recorded actual
 * transactions in the same window (actual always wins over its virtual
 * counterpart — see mergeActualAndVirtual). Never writes anything, never
 * materializes a virtual occurrence into a real row — per the "no
 * lazy-on-read materialization" requirement.
 */
export async function getMergedOccurrences(
  userId: string,
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
): Promise<MergedOccurrence[]> {
  const series = await listActiveSeriesForUser(userId);
  const exceptions = await listExceptionsForSeriesIds(series.map((s) => s.id));
  const exceptionsBySeriesId = new Map<string, typeof exceptions>();
  for (const exception of exceptions) {
    const list = exceptionsBySeriesId.get(exception.seriesId) ?? [];
    list.push(exception);
    exceptionsBySeriesId.set(exception.seriesId, list);
  }

  const virtual: VirtualOccurrence[] = [];
  for (const s of series) {
    const rawDates = expandRecurrence(s.rule, rangeStart, rangeEnd);
    const template = {
      type: s.type,
      currencyType: s.currencyType,
      amount: s.amount,
      source: s.source,
      bannerFamily: s.bannerFamily,
      note: s.note,
    };
    virtual.push(...applyExceptions(s.id, template, rawDates, exceptionsBySeriesId.get(s.id) ?? []));
  }

  const actualRows = await listActualOccurrencesInRange(userId, rangeStart, rangeEnd);
  const actual = actualRows.map(toActualOccurrence);

  return mergeActualAndVirtual(actual, virtual);
}
