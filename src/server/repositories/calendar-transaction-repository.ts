import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { BannerFamily } from "@/config/gacha";
import { CurrencyType, IncomeSource, TransactionType, type LocalDate } from "@/lib/calendar-math";
import type { ActualOccurrence } from "@/lib/calendar-math";
import { localDateToUtcDate, utcDateToLocalDate } from "./calendar-local-date";

function toPrismaEnum<T>(value: T): never {
  return value as never;
}

export type TransactionRecord = {
  id: string;
  userId: string;
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

type TransactionRow = {
  id: string;
  userId: string;
  localDate: Date;
  type: string;
  currencyType: string | null;
  amount: number;
  source: string | null;
  bannerFamily: string | null;
  note: string | null;
  seriesId: string | null;
  occurrenceDate: Date | null;
  version: number;
};

function toTransactionRecord(row: TransactionRow): TransactionRecord {
  return {
    id: row.id,
    userId: row.userId,
    localDate: utcDateToLocalDate(row.localDate),
    type: row.type as TransactionType,
    currencyType: row.currencyType as CurrencyType | null,
    amount: row.amount,
    source: row.source as IncomeSource | null,
    bannerFamily: row.bannerFamily as BannerFamily | null,
    note: row.note,
    seriesId: row.seriesId,
    occurrenceDate: row.occurrenceDate ? utcDateToLocalDate(row.occurrenceDate) : null,
    version: row.version,
  };
}

export function toActualOccurrence(record: TransactionRecord): ActualOccurrence {
  return {
    id: record.id,
    seriesId: record.seriesId,
    occurrenceDate: record.occurrenceDate,
    localDate: record.localDate,
    type: record.type,
    currencyType: record.currencyType,
    amount: record.amount,
    source: record.source,
    bannerFamily: record.bannerFamily,
    note: record.note,
    version: record.version,
  };
}

export type OneTimeTransactionFields = {
  localDate: LocalDate;
  type: TransactionType;
  currencyType: CurrencyType | null;
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
  timezone: string;
};

/** One CalendarEntry per (user, localDate) — created on demand, never duplicated (unique constraint). */
export async function getOrCreateCalendarEntry(
  tx: Prisma.TransactionClient,
  userId: string,
  localDate: LocalDate,
  timezone: string,
): Promise<string> {
  const localDateUtc = localDateToUtcDate(localDate);
  const entry = await tx.calendarEntry.upsert({
    where: { userId_localDate: { userId, localDate: localDateUtc } },
    create: { userId, localDate: localDateUtc, timezone },
    update: {},
  });
  return entry.id;
}

export async function getOneTimeTransactionById(
  userId: string,
  transactionId: string,
): Promise<TransactionRecord | null> {
  const row = await prisma.calendarTransaction.findFirst({ where: { id: transactionId, userId } });
  return row ? toTransactionRecord(row) : null;
}

export async function listActualOccurrencesInRange(
  userId: string,
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
): Promise<TransactionRecord[]> {
  const rows = await prisma.calendarTransaction.findMany({
    where: {
      userId,
      localDate: { gte: localDateToUtcDate(rangeStart), lte: localDateToUtcDate(rangeEnd) },
    },
  });
  return rows.map(toTransactionRecord);
}

export async function createOneTimeTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  fields: OneTimeTransactionFields,
): Promise<TransactionRecord> {
  const entryId = await getOrCreateCalendarEntry(tx, userId, fields.localDate, fields.timezone);
  const row = await tx.calendarTransaction.create({
    data: {
      userId,
      entryId,
      localDate: localDateToUtcDate(fields.localDate),
      timezone: fields.timezone,
      type: toPrismaEnum(fields.type),
      currencyType: fields.currencyType ? toPrismaEnum(fields.currencyType) : null,
      amount: fields.amount,
      source: fields.source ? toPrismaEnum(fields.source) : null,
      bannerFamily: fields.bannerFamily ? toPrismaEnum(fields.bannerFamily) : null,
      note: fields.note,
      seriesId: null,
      occurrenceDate: null,
    },
  });
  return toTransactionRecord(row);
}

export type TransactionUpsertResult =
  | { kind: "OK"; record: TransactionRecord }
  | { kind: "VERSION_CONFLICT"; current: TransactionRecord }
  | { kind: "NOT_FOUND" };

export async function updateOneTimeTransactionWithVersion(
  tx: Prisma.TransactionClient,
  userId: string,
  transactionId: string,
  fields: OneTimeTransactionFields,
  expectedVersion: number,
): Promise<TransactionUpsertResult> {
  // Only ever targets rows where seriesId is null — the caller
  // (calendar-transaction-service.ts) is responsible for rejecting
  // attempts to edit a materialized series transaction through this path
  // before calling this function.
  const entryId = await getOrCreateCalendarEntry(tx, userId, fields.localDate, fields.timezone);

  const result = await tx.calendarTransaction.updateMany({
    where: { id: transactionId, userId, seriesId: null, version: expectedVersion },
    data: {
      entryId,
      localDate: localDateToUtcDate(fields.localDate),
      timezone: fields.timezone,
      type: toPrismaEnum(fields.type),
      currencyType: fields.currencyType ? toPrismaEnum(fields.currencyType) : null,
      amount: fields.amount,
      source: fields.source ? toPrismaEnum(fields.source) : null,
      bannerFamily: fields.bannerFamily ? toPrismaEnum(fields.bannerFamily) : null,
      note: fields.note,
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    const current = await tx.calendarTransaction.findFirst({ where: { id: transactionId, userId } });
    if (!current) return { kind: "NOT_FOUND" };
    return { kind: "VERSION_CONFLICT", current: toTransactionRecord(current) };
  }

  const updated = await tx.calendarTransaction.findFirstOrThrow({ where: { id: transactionId, userId } });
  return { kind: "OK", record: toTransactionRecord(updated) };
}

export type TransactionDeleteResult =
  | { kind: "OK"; record: TransactionRecord }
  | { kind: "VERSION_CONFLICT"; current: TransactionRecord }
  | { kind: "NOT_FOUND" };

export async function deleteOneTimeTransactionWithVersion(
  tx: Prisma.TransactionClient,
  userId: string,
  transactionId: string,
  expectedVersion: number,
): Promise<TransactionDeleteResult> {
  const existing = await tx.calendarTransaction.findFirst({ where: { id: transactionId, userId } });
  if (!existing) return { kind: "NOT_FOUND" };
  if (existing.version !== expectedVersion) {
    return { kind: "VERSION_CONFLICT", current: toTransactionRecord(existing) };
  }

  const result = await tx.calendarTransaction.deleteMany({
    where: { id: transactionId, userId, seriesId: null, version: expectedVersion },
  });
  if (result.count === 0) {
    // Version moved between our check and the delete (rare race) — report conflict, not a phantom success.
    const current = await tx.calendarTransaction.findFirst({ where: { id: transactionId, userId } });
    if (!current) return { kind: "NOT_FOUND" };
    return { kind: "VERSION_CONFLICT", current: toTransactionRecord(current) };
  }

  return { kind: "OK", record: toTransactionRecord(existing) };
}
