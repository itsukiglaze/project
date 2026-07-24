import type { BannerFamily } from "@/config/gacha";
import type { CurrencyType, IncomeSource, LocalDate, TransactionType } from "@/lib/calendar-math";

/**
 * A single currency's total — currencies are NEVER summed together here.
 * Polychrome, Monochrome, Encrypted Master Tape, Master Tape, and Boopon
 * are five distinct units; combining them into one number would be
 * meaningless. See src/lib/gacha-math for the one place a real conversion
 * (Polychrome -> pulls) exists.
 */
export type CurrencyAmount = { currency: CurrencyType; amount: number };

/** An INCOME total for one (source, currency) pair — never blended across currencies. */
export type SourceCurrencyAmount = { source: IncomeSource; currency: CurrencyType; amount: number };

/**
 * A PULL count for one banner family. `currency` is included for
 * self-description only — each BannerFamily draws on exactly one
 * PullCurrency (see config/gacha.ts's BANNER_CONFIG), so this is never a
 * cross-currency sum. `pulls` is a COUNT of pull events, not a monetary
 * amount — pulls are never folded into netFlowPolychrome.
 */
export type BannerPullCount = { bannerFamily: BannerFamily; currency: CurrencyType; pulls: number };

/** An (type, currency) total, used for the byTransactionType breakdown. */
export type TransactionTypeCurrencyAmount = {
  type: TransactionType;
  currency: CurrencyType;
  amount: number;
};

export type StatisticsBucketTotals = {
  incomeTotals: CurrencyAmount[];
  expenseTotals: CurrencyAmount[];
  pullTotals: BannerPullCount[];
  /**
   * Polychrome-only net (income - expense, Polychrome-denominated only).
   * PULL never contributes here — pull events consume Tape/Boopon, not
   * Polychrome, and are represented purely as counts in `pullTotals`.
   * This is a RELATIVE net change over this bucket's items, not an
   * absolute wallet balance — see StatisticsOverviewResult's own docs.
   */
  netFlowPolychrome: number;
};

/**
 * One day of the continuous actual-to-projected trajectory. The
 * cumulative fields form a SINGLE continuous line: `actualCumulativeNetPolychrome`
 * is populated for every date <= today, `projectedCumulativeNetPolychrome`
 * for every date >= today (both populated, with the SAME value, exactly
 * at `today` — the point where the chart's solid line hands off to its
 * dashed continuation). Never two independent full-range series.
 */
export type StatisticsTimelinePoint = {
  date: LocalDate;
  actualIncomePolychrome: number;
  actualExpensePolychrome: number;
  /** Count of actual PULL transactions this day, any pull-currency — never a monetary amount. */
  actualPulls: number;
  actualCumulativeNetPolychrome: number | null;
  scheduledIncomePolychrome: number;
  scheduledExpensePolychrome: number;
  /**
   * Always 0 today: PULL is not recurring-eligible (a CalendarEventSeries
   * can only be INCOME/EXPENSE — see calendar-math/transaction-validation.ts),
   * so no virtual/scheduled occurrence is ever a PULL. Kept in the shape
   * rather than omitted, so the DTO stays self-describing.
   */
  scheduledPulls: number;
  projectedCumulativeNetPolychrome: number | null;
};
