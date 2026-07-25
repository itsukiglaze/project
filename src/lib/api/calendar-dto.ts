/**
 * Canonical wire-format DTOs and serializers for every calendar API
 * response that carries a `LocalDate` ({year,month,day}) value.
 *
 * Root cause this file fixes: `LocalDate` is a plain object internally
 * throughout calendar-math/server code, and `NextResponse.json()` /
 * `JSON.stringify` serialize a plain object as `{"year":...}`, NOT as the
 * "YYYY-MM-DD" string every client-side type already declared. Nothing
 * caught this because component/hook tests build in-memory fixtures
 * matching the (wrong) client type directly, never round-tripping through
 * real `Response.json()`/`fetch()` serialization.
 *
 * The fix: every API route that returns a LocalDate-bearing record must
 * run it through the matching `serialize*` function here before calling
 * `NextResponse.json()` — never rely on passing the raw domain object
 * through implicitly. This file has no framework import (no `next/server`,
 * no `server-only`), so it is safe for both server route handlers and
 * client-side code (features/calendar/api.ts) to import the DTO types
 * from — one canonical definition, not two independently-maintained ones.
 */
import type { BannerFamily } from "@/config/gacha";
import {
  formatLocalDate,
  type CurrencyType,
  type DailyBalancePoint,
  type ForecastResult,
  type IncomeSource,
  type LocalDate,
  type MergedOccurrence,
  type RecurrenceEndType,
  type RecurrenceFrequency,
  type RecurringTransactionType,
  type TransactionType,
} from "@/lib/calendar-math";

export function serializeLocalDate(date: LocalDate): string {
  return formatLocalDate(date);
}

export function serializeNullableLocalDate(date: LocalDate | null): string | null {
  return date === null ? null : serializeLocalDate(date);
}

// ---------------------------------------------------------------------------
// Recurrence rule / series
// ---------------------------------------------------------------------------

export type RecurrenceRuleDto = {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  startDate: string; // "YYYY-MM-DD"
  endType: RecurrenceEndType;
  endDate: string | null;
  occurrenceCount: number | null;
};

type RecurrenceRuleLike = {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  startDate: LocalDate;
  endType: RecurrenceEndType;
  endDate: LocalDate | null;
  occurrenceCount: number | null;
};

export function serializeRecurrenceRule(rule: RecurrenceRuleLike): RecurrenceRuleDto {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    daysOfWeek: rule.daysOfWeek,
    dayOfMonth: rule.dayOfMonth,
    startDate: serializeLocalDate(rule.startDate),
    endType: rule.endType,
    endDate: serializeNullableLocalDate(rule.endDate),
    occurrenceCount: rule.occurrenceCount,
  };
}

export type SeriesTemplateDto = {
  type: RecurringTransactionType;
  currencyType: CurrencyType | null;
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
};

export type SeriesRecordDto = SeriesTemplateDto & {
  id: string;
  rule: RecurrenceRuleDto;
  timezone: string;
  isActive: boolean;
  splitFromSeriesId: string | null;
  version: number;
};

type SeriesRecordLike = SeriesTemplateDto & {
  id: string;
  rule: RecurrenceRuleLike;
  timezone: string;
  isActive: boolean;
  splitFromSeriesId: string | null;
  version: number;
};

export function serializeSeriesRecord(record: SeriesRecordLike): SeriesRecordDto {
  return { ...record, rule: serializeRecurrenceRule(record.rule) };
}

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

export type ExceptionInputDto = {
  isCancelled: boolean;
  amountOverride: number | null;
  currencyTypeOverride: CurrencyType | null;
  sourceOverride: IncomeSource | null;
  bannerFamilyOverride: BannerFamily | null;
  noteOverride: string | null;
};

export type ExceptionRecordDto = ExceptionInputDto & {
  seriesId: string;
  occurrenceDate: string;
  version: number;
};

type ExceptionRecordLike = ExceptionInputDto & {
  seriesId: string;
  occurrenceDate: LocalDate;
  version: number;
};

export function serializeExceptionRecord(record: ExceptionRecordLike): ExceptionRecordDto {
  return { ...record, occurrenceDate: serializeLocalDate(record.occurrenceDate) };
}

// ---------------------------------------------------------------------------
// One-time transactions
// ---------------------------------------------------------------------------

/** The write-request shape — `timezone` is genuinely sent by the client here. */
export type TransactionInputDto = {
  localDate: string;
  type: TransactionType;
  currencyType: CurrencyType | null;
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
  timezone: string;
};

/**
 * The persisted-record shape — deliberately NOT `TransactionInputDto & {...}`.
 * The repository's TransactionRecord never carries `timezone` (it's a
 * write-only input, not a stored/returned field), so this type doesn't
 * claim one exists on a record either.
 */
export type TransactionRecordDto = {
  id: string;
  localDate: string;
  type: TransactionType;
  currencyType: CurrencyType | null;
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
  seriesId: string | null;
  occurrenceDate: string | null;
  version: number;
};

type TransactionRecordLike = {
  id: string;
  localDate: LocalDate;
  type: TransactionType;
  currencyType: CurrencyType | null;
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
  seriesId: string | null;
  occurrenceDate: LocalDate | null;
  version: number;
};

export function serializeTransactionRecord(record: TransactionRecordLike): TransactionRecordDto {
  return {
    ...record,
    localDate: serializeLocalDate(record.localDate),
    occurrenceDate: serializeNullableLocalDate(record.occurrenceDate),
  };
}

// ---------------------------------------------------------------------------
// Merged (actual/virtual) occurrences + forecast
// ---------------------------------------------------------------------------

export type MergedOccurrenceDto =
  | ({ kind: "actual" } & TransactionRecordDto)
  | ({ kind: "virtual" } & {
      seriesId: string;
      occurrenceDate: string;
      type: RecurringTransactionType;
      currencyType: CurrencyType | null;
      amount: number;
      source: IncomeSource | null;
      bannerFamily: BannerFamily | null;
      note: string | null;
    });

export function serializeMergedOccurrence(occurrence: MergedOccurrence): MergedOccurrenceDto {
  if (occurrence.kind === "actual") {
    const { kind, ...record } = occurrence;
    return { kind, ...serializeTransactionRecord(record) };
  }
  const { kind, occurrenceDate, ...rest } = occurrence;
  return { kind, occurrenceDate: serializeLocalDate(occurrenceDate), ...rest };
}

export type DailyBalancePointDto = { date: string; netChange: number; runningBalance: number };

function serializeDailyBalancePoint(point: DailyBalancePoint): DailyBalancePointDto {
  return { date: serializeLocalDate(point.date), netChange: point.netChange, runningBalance: point.runningBalance };
}

export type ForecastDto = {
  requestedHorizonDays: number;
  effectiveHorizonDays: number;
  rangeStart: string;
  rangeEnd: string;
  occurrences: MergedOccurrenceDto[];
  dailyBalances: DailyBalancePointDto[];
  projectedEndingBalance: number;
};

export function serializeForecastResult(result: ForecastResult): ForecastDto {
  return {
    requestedHorizonDays: result.requestedHorizonDays,
    effectiveHorizonDays: result.effectiveHorizonDays,
    rangeStart: serializeLocalDate(result.rangeStart),
    rangeEnd: serializeLocalDate(result.rangeEnd),
    occurrences: result.occurrences.map(serializeMergedOccurrence),
    dailyBalances: result.dailyBalances.map(serializeDailyBalancePoint),
    projectedEndingBalance: result.projectedEndingBalance,
  };
}
