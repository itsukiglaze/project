import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { CurrencyType, type LocalDate } from "@/lib/calendar-math";
import type { SnapshotCurrencyAmount } from "@/lib/resource-snapshot-math/types";
import { localDateToUtcDate, utcDateToLocalDate } from "./calendar-local-date";

function toPrismaEnum<T>(value: T): never {
  return value as never;
}

export type VersionedSnapshotRecord = {
  id: string;
  userId: string;
  localDate: LocalDate;
  capturedAt: Date;
  timezone: string;
  note: string | null;
  items: SnapshotCurrencyAmount[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type SnapshotRow = Prisma.ResourceSnapshotGetPayload<{ include: { items: true } }>;

function toRecord(row: SnapshotRow): VersionedSnapshotRecord {
  return {
    id: row.id,
    userId: row.userId,
    localDate: utcDateToLocalDate(row.localDate),
    capturedAt: row.capturedAt,
    timezone: row.timezone,
    note: row.note,
    items: row.items.map((item) => ({
      currencyType: item.currencyType as CurrencyType,
      amount: item.amount,
    })),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getSnapshotByLocalDate(
  userId: string,
  localDate: LocalDate,
): Promise<VersionedSnapshotRecord | null> {
  const row = await prisma.resourceSnapshot.findUnique({
    where: { userId_localDate: { userId, localDate: localDateToUtcDate(localDate) } },
    include: { items: true },
  });
  return row ? toRecord(row) : null;
}

/** The most recent snapshot the user has ever saved, by localDate — used as the "current" observed balance. */
export async function getLatestSnapshot(userId: string): Promise<VersionedSnapshotRecord | null> {
  const row = await prisma.resourceSnapshot.findFirst({
    where: { userId },
    orderBy: { localDate: "desc" },
    include: { items: true },
  });
  return row ? toRecord(row) : null;
}

/**
 * The most recent snapshot strictly BEFORE `localDate` — the correct
 * comparison baseline for a snapshot dated `localDate`, whether that's
 * today's new save or a backfilled/edited historical date. Deliberately
 * NOT "the global latest snapshot" — editing an old date must always
 * compare against ITS OWN predecessor, not whatever is most recent overall.
 */
export async function getLatestSnapshotBefore(
  userId: string,
  localDate: LocalDate,
): Promise<VersionedSnapshotRecord | null> {
  const row = await prisma.resourceSnapshot.findFirst({
    where: { userId, localDate: { lt: localDateToUtcDate(localDate) } },
    orderBy: { localDate: "desc" },
    include: { items: true },
  });
  return row ? toRecord(row) : null;
}

/** Every snapshot at or before `to`, ascending — callers needing a range slice their own [from,to] window out of this after computing sequential deltas (see resource-snapshot-service.ts). */
export async function listSnapshotsUpTo(userId: string, to: LocalDate): Promise<VersionedSnapshotRecord[]> {
  const rows = await prisma.resourceSnapshot.findMany({
    where: { userId, localDate: { lte: localDateToUtcDate(to) } },
    orderBy: { localDate: "asc" },
    include: { items: true },
  });
  return rows.map(toRecord);
}

export type UpsertSnapshotResult =
  | { kind: "OK"; record: VersionedSnapshotRecord }
  | { kind: "VERSION_CONFLICT"; current: VersionedSnapshotRecord | null };

/**
 * Creates or replaces the ONE logical snapshot for (userId, localDate).
 * `expectedVersion === 0` means "I believe no snapshot exists yet for this
 * date" (create path); otherwise this must match the existing row's
 * version (update-in-place path) or the write is rejected as a conflict.
 * Items are fully replaced (delete then recreate) — a currency omitted
 * from `items` is dropped from this date's snapshot, never silently
 * coerced to 0 (see resource-snapshot-math/comparison.ts for how that
 * shows up in comparisons).
 */
export async function upsertSnapshotWithVersion(
  tx: Prisma.TransactionClient,
  userId: string,
  localDate: LocalDate,
  timezone: string,
  note: string | null,
  items: readonly SnapshotCurrencyAmount[],
  expectedVersion: number,
): Promise<UpsertSnapshotResult> {
  const localDateUtc = localDateToUtcDate(localDate);

  if (expectedVersion === 0) {
    // Checked BEFORE attempting the create, rather than caught via a P2002
    // recovery afterward: once one statement in a Postgres transaction
    // fails (e.g. a unique-constraint violation from `create`), Postgres
    // aborts the whole transaction — any further statement in the SAME
    // transaction (even a harmless follow-up `findUnique`) immediately
    // fails with 25P02 "current transaction is aborted", which a
    // catch-and-recover pattern can't work around. Checking first avoids
    // ever hitting that constraint in the ordinary "resubmitted with a
    // stale version-0 guess" case; a genuinely simultaneous concurrent
    // create for the same (userId, localDate) is a real but narrow race
    // this doesn't cover, on top of an already-narrow single-user surface.
    const existing = await tx.resourceSnapshot.findUnique({
      where: { userId_localDate: { userId, localDate: localDateUtc } },
      include: { items: true },
    });
    if (existing) {
      return { kind: "VERSION_CONFLICT", current: toRecord(existing) };
    }

    const created = await tx.resourceSnapshot.create({
      data: {
        userId,
        localDate: localDateUtc,
        timezone,
        note,
        version: 1,
        items: { create: items.map((item) => ({ currencyType: toPrismaEnum(item.currencyType), amount: item.amount })) },
      },
      include: { items: true },
    });
    return { kind: "OK", record: toRecord(created) };
  }

  const result = await tx.resourceSnapshot.updateMany({
    where: { userId, localDate: localDateUtc, version: expectedVersion },
    data: { timezone, note, capturedAt: new Date(), version: { increment: 1 } },
  });

  if (result.count === 0) {
    const current = await tx.resourceSnapshot.findUnique({
      where: { userId_localDate: { userId, localDate: localDateUtc } },
      include: { items: true },
    });
    return { kind: "VERSION_CONFLICT", current: current ? toRecord(current) : null };
  }

  const updated = await tx.resourceSnapshot.findUniqueOrThrow({
    where: { userId_localDate: { userId, localDate: localDateUtc } },
  });
  // Full replace: drop every existing item for this snapshot, then insert exactly the given set.
  await tx.resourceSnapshotItem.deleteMany({ where: { snapshotId: updated.id } });
  if (items.length > 0) {
    await tx.resourceSnapshotItem.createMany({
      data: items.map((item) => ({
        snapshotId: updated.id,
        currencyType: toPrismaEnum(item.currencyType),
        amount: item.amount,
      })),
    });
  }

  const final = await tx.resourceSnapshot.findUniqueOrThrow({
    where: { userId_localDate: { userId, localDate: localDateUtc } },
    include: { items: true },
  });
  return { kind: "OK", record: toRecord(final) };
}

export type DeleteSnapshotResult =
  | { kind: "OK"; record: VersionedSnapshotRecord }
  | { kind: "VERSION_CONFLICT"; current: VersionedSnapshotRecord }
  | { kind: "NOT_FOUND" };

export async function deleteSnapshotWithVersion(
  tx: Prisma.TransactionClient,
  userId: string,
  localDate: LocalDate,
  expectedVersion: number,
): Promise<DeleteSnapshotResult> {
  const localDateUtc = localDateToUtcDate(localDate);
  const existing = await tx.resourceSnapshot.findUnique({
    where: { userId_localDate: { userId, localDate: localDateUtc } },
    include: { items: true },
  });
  if (!existing) return { kind: "NOT_FOUND" };
  if (existing.version !== expectedVersion) {
    return { kind: "VERSION_CONFLICT", current: toRecord(existing) };
  }

  const result = await tx.resourceSnapshot.deleteMany({
    where: { userId, localDate: localDateUtc, version: expectedVersion },
  });
  if (result.count === 0) {
    const current = await tx.resourceSnapshot.findUnique({
      where: { userId_localDate: { userId, localDate: localDateUtc } },
      include: { items: true },
    });
    if (!current) return { kind: "NOT_FOUND" };
    return { kind: "VERSION_CONFLICT", current: toRecord(current) };
  }

  return { kind: "OK", record: toRecord(existing) };
}

/**
 * Keeps `ResourceBalance` (the Calculator's "saved data" single-row cache)
 * in sync with whichever snapshot is now the user's latest, INSIDE the
 * same transaction as a snapshot write — see resource-snapshot-service.ts
 * for the full source-of-truth writeup. Only overwrites the currencies
 * actually present on the latest snapshot; a currency that snapshot didn't
 * track is left at its previous ResourceBalance value, never zeroed. If no
 * snapshot remains at all (e.g. the only one was just deleted),
 * ResourceBalance is left completely untouched — deleting history must
 * never wipe the current balance to zero as a side effect.
 */
export async function syncResourceBalanceFromLatestSnapshot(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const latest = await tx.resourceSnapshot.findFirst({
    where: { userId },
    orderBy: { localDate: "desc" },
    include: { items: true },
  });
  if (!latest) return;

  const fields: Record<string, number> = {};
  const fieldNameByCurrency: Record<CurrencyType, string> = {
    [CurrencyType.POLYCHROME]: "polychrome",
    [CurrencyType.ENCRYPTED_MASTER_TAPE]: "encryptedMasterTape",
    [CurrencyType.MASTER_TAPE]: "masterTape",
    [CurrencyType.BOOPON]: "boopon",
    [CurrencyType.MONOCHROME]: "monochrome",
  };
  for (const item of latest.items) {
    fields[fieldNameByCurrency[item.currencyType as CurrencyType]] = item.amount;
  }

  await tx.resourceBalance.upsert({
    where: { userId },
    create: {
      userId,
      polychrome: fields.polychrome ?? 0,
      encryptedMasterTape: fields.encryptedMasterTape ?? 0,
      masterTape: fields.masterTape ?? 0,
      boopon: fields.boopon ?? 0,
      monochrome: fields.monochrome ?? 0,
    },
    update: { ...fields, version: { increment: 1 } },
  });
}
