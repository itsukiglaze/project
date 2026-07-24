import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { BannerFamily } from "@/config/gacha";
import { CurrencyType, IncomeSource, type LocalDate, type SeriesException } from "@/lib/calendar-math";
import { localDateToUtcDate, utcDateToLocalDate } from "./calendar-local-date";

function toPrismaEnum<T>(value: T): never {
  return value as never;
}

export type ExceptionRecord = SeriesException & { seriesId: string; version: number };

type ExceptionRow = {
  seriesId: string;
  occurrenceDate: Date;
  isCancelled: boolean;
  amountOverride: number | null;
  currencyTypeOverride: string | null;
  sourceOverride: string | null;
  bannerFamilyOverride: string | null;
  noteOverride: string | null;
  version: number;
};

function toExceptionRecord(row: ExceptionRow): ExceptionRecord {
  return {
    seriesId: row.seriesId,
    occurrenceDate: utcDateToLocalDate(row.occurrenceDate),
    isCancelled: row.isCancelled,
    amountOverride: row.amountOverride,
    currencyTypeOverride: row.currencyTypeOverride as CurrencyType | null,
    sourceOverride: row.sourceOverride as IncomeSource | null,
    bannerFamilyOverride: row.bannerFamilyOverride as BannerFamily | null,
    noteOverride: row.noteOverride,
    version: row.version,
  };
}

export type ExceptionWriteFields = {
  isCancelled: boolean;
  amountOverride: number | null;
  currencyTypeOverride: CurrencyType | null;
  sourceOverride: IncomeSource | null;
  bannerFamilyOverride: BannerFamily | null;
  noteOverride: string | null;
};

function toPrismaWriteData(fields: ExceptionWriteFields) {
  return {
    isCancelled: fields.isCancelled,
    amountOverride: fields.amountOverride,
    currencyTypeOverride: fields.currencyTypeOverride ? toPrismaEnum(fields.currencyTypeOverride) : null,
    sourceOverride: fields.sourceOverride ? toPrismaEnum(fields.sourceOverride) : null,
    bannerFamilyOverride: fields.bannerFamilyOverride ? toPrismaEnum(fields.bannerFamilyOverride) : null,
    noteOverride: fields.noteOverride,
  };
}

export async function getException(
  seriesId: string,
  occurrenceDate: LocalDate,
): Promise<ExceptionRecord | null> {
  const row = await prisma.calendarEventException.findUnique({
    where: { seriesId_occurrenceDate: { seriesId, occurrenceDate: localDateToUtcDate(occurrenceDate) } },
  });
  return row ? toExceptionRecord(row) : null;
}

export async function listExceptionsForSeries(seriesId: string): Promise<ExceptionRecord[]> {
  const rows = await prisma.calendarEventException.findMany({ where: { seriesId } });
  return rows.map(toExceptionRecord);
}

export async function listExceptionsForSeriesIds(seriesIds: string[]): Promise<ExceptionRecord[]> {
  if (seriesIds.length === 0) return [];
  const rows = await prisma.calendarEventException.findMany({ where: { seriesId: { in: seriesIds } } });
  return rows.map(toExceptionRecord);
}

export type ExceptionUpsertResult =
  | { kind: "OK"; record: ExceptionRecord }
  | { kind: "VERSION_CONFLICT"; current: ExceptionRecord }
  | { kind: "NOT_FOUND" };

/**
 * Optimistic-concurrency upsert for a single occurrence exception.
 * `expectedVersion = 0` is the sentinel for "no exception exists yet for
 * this occurrence" (create path); any other value targets an existing
 * exception row (update path), atomically checked via `updateMany`.
 */
export async function upsertExceptionWithVersion(
  tx: Prisma.TransactionClient,
  seriesId: string,
  occurrenceDate: LocalDate,
  fields: ExceptionWriteFields,
  expectedVersion: number,
): Promise<ExceptionUpsertResult> {
  const occurrenceDateUtc = localDateToUtcDate(occurrenceDate);
  const data = toPrismaWriteData(fields);

  if (expectedVersion === 0) {
    try {
      const created = await tx.calendarEventException.create({
        data: { seriesId, occurrenceDate: occurrenceDateUtc, ...data, version: 1 },
      });
      return { kind: "OK", record: toExceptionRecord(created) };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err as { code: string }).code === "P2002"
      ) {
        const existing = await tx.calendarEventException.findUnique({
          where: { seriesId_occurrenceDate: { seriesId, occurrenceDate: occurrenceDateUtc } },
        });
        if (!existing) return { kind: "NOT_FOUND" };
        return { kind: "VERSION_CONFLICT", current: toExceptionRecord(existing) };
      }
      throw err;
    }
  }

  const result = await tx.calendarEventException.updateMany({
    where: { seriesId, occurrenceDate: occurrenceDateUtc, version: expectedVersion },
    data: { ...data, version: { increment: 1 } },
  });

  if (result.count === 0) {
    const current = await tx.calendarEventException.findUnique({
      where: { seriesId_occurrenceDate: { seriesId, occurrenceDate: occurrenceDateUtc } },
    });
    if (!current) return { kind: "NOT_FOUND" };
    return { kind: "VERSION_CONFLICT", current: toExceptionRecord(current) };
  }

  const updated = await tx.calendarEventException.findUniqueOrThrow({
    where: { seriesId_occurrenceDate: { seriesId, occurrenceDate: occurrenceDateUtc } },
  });
  return { kind: "OK", record: toExceptionRecord(updated) };
}

/**
 * Split-time reassignment: moves every exception dated on/after
 * `fromDate` from `oldSeriesId` to `newSeriesId`. Exceptions before
 * `fromDate` stay with the (now-closed) predecessor series, matching how
 * materialized transactions are handled — see
 * calendar-event-series-service.ts's splitSeries.
 */
export async function reassignExceptionsFromDate(
  tx: Prisma.TransactionClient,
  oldSeriesId: string,
  newSeriesId: string,
  fromDate: LocalDate,
): Promise<{ reassignedCount: number }> {
  const result = await tx.calendarEventException.updateMany({
    where: { seriesId: oldSeriesId, occurrenceDate: { gte: localDateToUtcDate(fromDate) } },
    data: { seriesId: newSeriesId },
  });
  return { reassignedCount: result.count };
}
