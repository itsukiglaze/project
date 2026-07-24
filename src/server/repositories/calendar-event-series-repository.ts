import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { BannerFamily } from "@/config/gacha";
import {
  CurrencyType,
  IncomeSource,
  RecurrenceEndType,
  RecurrenceFrequency,
  TransactionType,
  type LocalDate,
  type RecurrenceRule,
  type RecurringTransactionType,
} from "@/lib/calendar-math";
import { localDateToUtcDate, utcDateToLocalDate } from "./calendar-local-date";

// Bridges between calendar-math's own domain enums and Prisma's generated
// ones — identical string values by design (see prisma/schema.prisma).
// Same pattern as toPrismaBannerFamily in banner-state-repository.ts.
function toPrismaEnum<T>(value: T): never {
  return value as never;
}

export type SeriesRecord = {
  id: string;
  userId: string;
  type: RecurringTransactionType;
  currencyType: CurrencyType | null;
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
  rule: RecurrenceRule;
  /** Frozen at creation — see prisma/schema.prisma comment on this column. */
  timezone: string;
  isActive: boolean;
  splitFromSeriesId: string | null;
  version: number;
};

type SeriesRow = {
  id: string;
  userId: string;
  type: string;
  currencyType: string | null;
  amount: number;
  source: string | null;
  bannerFamily: string | null;
  note: string | null;
  frequency: string;
  interval: number;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  startDate: Date;
  timezone: string;
  endType: string;
  endDate: Date | null;
  occurrenceCount: number | null;
  isActive: boolean;
  splitFromSeriesId: string | null;
  version: number;
};

function toSeriesRecord(row: SeriesRow): SeriesRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as RecurringTransactionType,
    currencyType: row.currencyType as CurrencyType | null,
    amount: row.amount,
    source: row.source as IncomeSource | null,
    bannerFamily: row.bannerFamily as BannerFamily | null,
    note: row.note,
    timezone: row.timezone,
    rule: {
      frequency: row.frequency as RecurrenceFrequency,
      interval: row.interval,
      daysOfWeek: row.daysOfWeek,
      dayOfMonth: row.dayOfMonth,
      startDate: utcDateToLocalDate(row.startDate),
      endType: row.endType as RecurrenceEndType,
      endDate: row.endDate ? utcDateToLocalDate(row.endDate) : null,
      occurrenceCount: row.occurrenceCount,
    },
    isActive: row.isActive,
    splitFromSeriesId: row.splitFromSeriesId,
    version: row.version,
  };
}

export type SeriesWriteFields = {
  type: RecurringTransactionType;
  currencyType: CurrencyType | null;
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
  rule: RecurrenceRule;
};

function toPrismaWriteData(fields: SeriesWriteFields) {
  return {
    type: toPrismaEnum(fields.type as TransactionType),
    currencyType: fields.currencyType ? toPrismaEnum(fields.currencyType) : null,
    amount: fields.amount,
    source: fields.source ? toPrismaEnum(fields.source) : null,
    bannerFamily: fields.bannerFamily ? toPrismaEnum(fields.bannerFamily) : null,
    note: fields.note,
    frequency: toPrismaEnum(fields.rule.frequency),
    interval: fields.rule.interval,
    daysOfWeek: fields.rule.daysOfWeek,
    dayOfMonth: fields.rule.dayOfMonth,
    startDate: localDateToUtcDate(fields.rule.startDate),
    endType: toPrismaEnum(fields.rule.endType),
    endDate: fields.rule.endDate ? localDateToUtcDate(fields.rule.endDate) : null,
    occurrenceCount: fields.rule.occurrenceCount,
  };
}

/** Ownership-scoped read — returns null both when missing AND when owned by someone else. */
export async function getSeriesById(userId: string, seriesId: string): Promise<SeriesRecord | null> {
  const row = await prisma.calendarEventSeries.findFirst({ where: { id: seriesId, userId } });
  return row ? toSeriesRecord(row) : null;
}

export async function listActiveSeriesForUser(userId: string): Promise<SeriesRecord[]> {
  const rows = await prisma.calendarEventSeries.findMany({ where: { userId, isActive: true } });
  return rows.map(toSeriesRecord);
}

export async function createSeries(
  tx: Prisma.TransactionClient,
  userId: string,
  fields: SeriesWriteFields,
  timezone: string,
  splitFromSeriesId?: string | null,
): Promise<SeriesRecord> {
  const data = toPrismaWriteData(fields);
  const row = await tx.calendarEventSeries.create({
    data: { ...data, timezone, userId, splitFromSeriesId: splitFromSeriesId ?? null },
  });
  return toSeriesRecord(row);
}

export type SeriesUpsertResult =
  | { kind: "OK"; record: SeriesRecord }
  | { kind: "VERSION_CONFLICT"; current: SeriesRecord }
  | { kind: "NOT_FOUND" };

/**
 * Atomic optimistic-concurrency update — the version check IS the
 * `updateMany({ where: { id, userId, version: expectedVersion } })`
 * clause, a single SQL statement, not a check-then-act pattern.
 */
export async function updateSeriesWithVersion(
  tx: Prisma.TransactionClient,
  userId: string,
  seriesId: string,
  fields: SeriesWriteFields,
  expectedVersion: number,
): Promise<SeriesUpsertResult> {
  const data = toPrismaWriteData(fields);
  const result = await tx.calendarEventSeries.updateMany({
    where: { id: seriesId, userId, version: expectedVersion },
    data: { ...data, version: { increment: 1 } },
  });

  if (result.count === 0) {
    const current = await tx.calendarEventSeries.findFirst({ where: { id: seriesId, userId } });
    if (!current) return { kind: "NOT_FOUND" };
    return { kind: "VERSION_CONFLICT", current: toSeriesRecord(current) };
  }

  const updated = await tx.calendarEventSeries.findFirstOrThrow({ where: { id: seriesId, userId } });
  return { kind: "OK", record: toSeriesRecord(updated) };
}

/** Sets endType=UNTIL_DATE / endDate=closeDate — used by the split flow to close off the predecessor series. */
export async function closeSeriesAtDate(
  tx: Prisma.TransactionClient,
  userId: string,
  seriesId: string,
  closeDate: LocalDate,
  expectedVersion: number,
): Promise<SeriesUpsertResult> {
  const result = await tx.calendarEventSeries.updateMany({
    where: { id: seriesId, userId, version: expectedVersion },
    data: {
      endType: toPrismaEnum(RecurrenceEndType.UNTIL_DATE),
      endDate: localDateToUtcDate(closeDate),
      occurrenceCount: null,
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    const current = await tx.calendarEventSeries.findFirst({ where: { id: seriesId, userId } });
    if (!current) return { kind: "NOT_FOUND" };
    return { kind: "VERSION_CONFLICT", current: toSeriesRecord(current) };
  }

  const updated = await tx.calendarEventSeries.findFirstOrThrow({ where: { id: seriesId, userId } });
  return { kind: "OK", record: toSeriesRecord(updated) };
}

export async function softDeleteSeriesWithVersion(
  tx: Prisma.TransactionClient,
  userId: string,
  seriesId: string,
  expectedVersion: number,
): Promise<SeriesUpsertResult> {
  const result = await tx.calendarEventSeries.updateMany({
    where: { id: seriesId, userId, version: expectedVersion },
    data: { isActive: false, version: { increment: 1 } },
  });

  if (result.count === 0) {
    const current = await tx.calendarEventSeries.findFirst({ where: { id: seriesId, userId } });
    if (!current) return { kind: "NOT_FOUND" };
    return { kind: "VERSION_CONFLICT", current: toSeriesRecord(current) };
  }

  const updated = await tx.calendarEventSeries.findFirstOrThrow({ where: { id: seriesId, userId } });
  return { kind: "OK", record: toSeriesRecord(updated) };
}
