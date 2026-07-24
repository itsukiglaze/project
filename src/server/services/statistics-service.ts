import "server-only";
import { compareLocalDate, type LocalDate, type MergedOccurrence } from "@/lib/calendar-math";
import {
  computeBucketTotals,
  mergeCurrencyTotals,
  mergePullCounts,
  sumBySource,
  sumByTransactionType,
} from "@/lib/statistics-math/aggregate";
import { buildStatisticsTimeline } from "@/lib/statistics-math/timeline";
import type {
  BannerPullCount,
  CurrencyAmount,
  SourceCurrencyAmount,
  StatisticsBucketTotals,
  StatisticsTimelinePoint,
  TransactionTypeCurrencyAmount,
} from "@/lib/statistics-math/types";
import { getMergedOccurrences } from "./calendar-occurrence-service";
import {
  listActualOccurrencesInRange,
  type TransactionRecord,
} from "@/server/repositories/calendar-transaction-repository";

export type StatisticsOverviewResult = {
  range: { from: LocalDate; to: LocalDate; today: LocalDate };
  /** kind==="actual" items with date <= today. */
  actual: StatisticsBucketTotals;
  /** kind==="virtual" (scheduled) items with date > today — already deduped against materialized actuals. */
  scheduled: StatisticsBucketTotals;
  /** actual + scheduled, merged per currency/family — NOT a retrospective forecast-accuracy claim. */
  expectedRangeTotal: {
    income: CurrencyAmount[];
    expense: CurrencyAmount[];
    pulls: BannerPullCount[];
    netFlowPolychrome: number;
  };
  timeline: StatisticsTimelinePoint[];
  /** Actual-only (real logged history), grouped different ways for the trends panel. */
  breakdowns: {
    bySource: SourceCurrencyAmount[];
    byBannerFamily: BannerPullCount[];
    byTransactionType: TransactionTypeCurrencyAmount[];
  };
};

/**
 * Read-only. Two data reads compose this:
 *
 *  - getMergedOccurrences (already-shipped, Stage 5) gives the full
 *    actual+virtual merge for the whole range, correctly deduped
 *    (a virtual occurrence that's already been materialized into a real
 *    transaction never appears as virtual) — used for the SCHEDULED
 *    bucket and the timeline.
 *  - listActualOccurrencesInRange is called a SECOND time, directly, for
 *    the ACTUAL bucket + breakdowns: merge.ts's ActualOccurrence type
 *    (used inside getMergedOccurrences) deliberately strips `source`/
 *    `bannerFamily` for its own purposes, but this service needs them for
 *    the bySource/byBannerFamily breakdowns. This re-reads the same table
 *    once more than strictly necessary — an accepted, documented tradeoff
 *    to avoid widening a Stage 5 calendar-math type just for this read.
 *
 * "Scheduled" excludes any virtual occurrence dated on or before `today`
 * (an unmaterialized past occurrence isn't a real actual, and isn't a
 * meaningful "still ahead" projection either) — see DEVELOPMENT_STATUS.md
 * for this documented scope decision.
 */
export async function getStatisticsOverview(
  userId: string,
  today: LocalDate,
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
): Promise<StatisticsOverviewResult> {
  const merged = await getMergedOccurrences(userId, rangeStart, rangeEnd);

  const actualRangeEnd = compareLocalDate(rangeEnd, today) < 0 ? rangeEnd : today;
  const actualRecords: TransactionRecord[] =
    compareLocalDate(actualRangeEnd, rangeStart) < 0
      ? []
      : await listActualOccurrencesInRange(userId, rangeStart, actualRangeEnd);

  const scheduledItems = merged.filter(
    (o): o is Extract<MergedOccurrence, { kind: "virtual" }> =>
      o.kind === "virtual" && compareLocalDate(o.occurrenceDate, today) > 0,
  );

  const actual = computeBucketTotals(actualRecords);
  const scheduled = computeBucketTotals(scheduledItems);

  const timeline = buildStatisticsTimeline({ occurrences: merged, today, rangeStart, rangeEnd });

  return {
    range: { from: rangeStart, to: rangeEnd, today },
    actual,
    scheduled,
    expectedRangeTotal: {
      income: mergeCurrencyTotals(actual.incomeTotals, scheduled.incomeTotals),
      expense: mergeCurrencyTotals(actual.expenseTotals, scheduled.expenseTotals),
      pulls: mergePullCounts(actual.pullTotals, scheduled.pullTotals),
      netFlowPolychrome: actual.netFlowPolychrome + scheduled.netFlowPolychrome,
    },
    timeline,
    breakdowns: {
      bySource: sumBySource(actualRecords),
      byBannerFamily: actual.pullTotals,
      byTransactionType: sumByTransactionType(actualRecords),
    },
  };
}
