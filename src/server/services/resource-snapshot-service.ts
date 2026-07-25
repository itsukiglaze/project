import "server-only";
import { prisma } from "@/lib/db/prisma";
import { compareLocalDate, CurrencyType, type LocalDate } from "@/lib/calendar-math";
import { compareSnapshotItems, type CurrencyComparison } from "@/lib/resource-snapshot-math/comparison";
import type { SnapshotCurrencyAmount } from "@/lib/resource-snapshot-math/types";
import { computeRequestHash } from "@/lib/idempotency-hash";
import {
  deleteSnapshotWithVersion,
  getLatestSnapshot,
  getLatestSnapshotBefore,
  getSnapshotByLocalDate,
  listSnapshotsUpTo,
  syncResourceBalanceFromLatestSnapshot,
  upsertSnapshotWithVersion,
  type VersionedSnapshotRecord,
} from "@/server/repositories/resource-snapshot-repository";
import {
  createIdempotencyRecord,
  isIdempotencyConflict,
  lookupIdempotencyRecord,
} from "@/server/repositories/idempotency-repository";
import { createAuditLog } from "@/server/repositories/audit-log-repository";

const MAX_SNAPSHOT_AMOUNT = 1_000_000_000;

export type SnapshotInput = {
  localDate: LocalDate;
  timezone: string;
  note: string | null;
  items: SnapshotCurrencyAmount[];
};

function validateSnapshotInput(input: SnapshotInput): string[] {
  const errors: string[] = [];
  const seen = new Set<CurrencyType>();
  for (const item of input.items) {
    if (seen.has(item.currencyType)) {
      errors.push(`duplicate currencyType in items: ${item.currencyType}`);
    }
    seen.add(item.currencyType);
    if (
      !Number.isInteger(item.amount) ||
      !Number.isSafeInteger(item.amount) ||
      item.amount < 0 ||
      item.amount > MAX_SNAPSHOT_AMOUNT
    ) {
      errors.push(
        `amount for ${item.currencyType} must be a non-negative safe integer up to ${MAX_SNAPSHOT_AMOUNT}, got ${String(item.amount)}`,
      );
    }
  }
  return errors;
}

export type SnapshotComparisonView = {
  record: VersionedSnapshotRecord;
  comparison: CurrencyComparison[];
  previousLocalDate: LocalDate | null;
};

function buildComparisonView(
  record: VersionedSnapshotRecord,
  previous: VersionedSnapshotRecord | null,
): SnapshotComparisonView {
  return {
    record,
    comparison: compareSnapshotItems(record.items, previous ? previous.items : null),
    previousLocalDate: previous ? previous.localDate : null,
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * The user's latest saved snapshot, compared against the one before it —
 * this is the "Баланс ресурсов сегодня" card's data source. `null` means
 * the user has never saved a snapshot yet ("Первое сохранение").
 */
export async function getLatestResourceSnapshot(userId: string): Promise<SnapshotComparisonView | null> {
  const latest = await getLatestSnapshot(userId);
  if (!latest) return null;
  const previous = await getLatestSnapshotBefore(userId, latest.localDate);
  return buildComparisonView(latest, previous);
}

/**
 * History in ascending date order within [from, to], each entry compared
 * against ITS OWN immediately-preceding snapshot (which may fall before
 * `from`) — never against the global latest. Fetches everything up to
 * `to` first so the earliest entry in range still gets a correct
 * comparison against a snapshot dated before `from`.
 */
export async function listResourceSnapshotHistory(
  userId: string,
  from: LocalDate,
  to: LocalDate,
): Promise<SnapshotComparisonView[]> {
  const ascendingUpToEnd = await listSnapshotsUpTo(userId, to);
  const views: SnapshotComparisonView[] = ascendingUpToEnd.map((record, index) =>
    buildComparisonView(record, index > 0 ? ascendingUpToEnd[index - 1] : null),
  );
  return views.filter((view) => compareLocalDate(view.record.localDate, from) >= 0);
}

export async function getResourceSnapshotByDate(
  userId: string,
  localDate: LocalDate,
): Promise<SnapshotComparisonView | null> {
  const record = await getSnapshotByLocalDate(userId, localDate);
  if (!record) return null;
  const previous = await getLatestSnapshotBefore(userId, localDate);
  return buildComparisonView(record, previous);
}

// ---------------------------------------------------------------------------
// Save (create or replace the snapshot for one local date)
// ---------------------------------------------------------------------------

const SAVE_ACTION = "SAVE_RESOURCE_SNAPSHOT";

export type SaveSnapshotSuccess = { ok: true; snapshot: SnapshotComparisonView; replay: boolean };
export type SaveSnapshotResult =
  | SaveSnapshotSuccess
  | { ok: false; kind: "VALIDATION_ERROR"; errors: string[] }
  | { ok: false; kind: "STALE_STATE"; current: VersionedSnapshotRecord | null }
  | { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" };

/**
 * Creates or replaces the snapshot for `input.localDate`, atomically keeps
 * `ResourceBalance` in sync (see resource-snapshot-repository.ts's
 * syncResourceBalanceFromLatestSnapshot for exactly what "in sync" means
 * when the saved date isn't the latest one), and writes an audit log entry
 * — all inside one `prisma.$transaction`, mirroring resource-service.ts /
 * calendar-transaction-service.ts's established shape.
 *
 * The "previous" snapshot used for the returned comparison is read BEFORE
 * the transaction starts (same pattern as resource-service.ts's own
 * `previous` read) and is stored as part of the idempotent response, so a
 * replay returns the exact comparison that was computed at write time, not
 * one recomputed against whatever the database looks like now.
 */
export async function saveResourceSnapshot(
  userId: string,
  input: SnapshotInput,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<SaveSnapshotResult> {
  const errors = validateSnapshotInput(input);
  if (errors.length > 0) return { ok: false, kind: "VALIDATION_ERROR", errors };

  const requestHash = computeRequestHash({ input, expectedVersion });
  const lookup = await lookupIdempotencyRecord<SaveSnapshotSuccess>(userId, SAVE_ACTION, idempotencyKey, requestHash);
  if (lookup.status === "match") return { ...lookup.response, replay: true };
  if (lookup.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };

  const previous = await getLatestSnapshotBefore(userId, input.localDate);

  try {
    return await prisma.$transaction(async (tx) => {
      const upsertResult = await upsertSnapshotWithVersion(
        tx,
        userId,
        input.localDate,
        input.timezone,
        input.note,
        input.items,
        expectedVersion,
      );
      if (upsertResult.kind === "VERSION_CONFLICT") {
        return { ok: false, kind: "STALE_STATE", current: upsertResult.current };
      }

      await syncResourceBalanceFromLatestSnapshot(tx, userId);
      await createAuditLog(tx, userId, SAVE_ACTION, {
        localDate: upsertResult.record.localDate,
        items: upsertResult.record.items,
      });

      const response: SaveSnapshotSuccess = {
        ok: true,
        snapshot: buildComparisonView(upsertResult.record, previous),
        replay: false,
      };
      await createIdempotencyRecord(tx, userId, SAVE_ACTION, idempotencyKey, requestHash, response);
      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<SaveSnapshotSuccess>(userId, SAVE_ACTION, idempotencyKey, requestHash);
      if (winner.status === "match") return { ...winner.response, replay: true };
      if (winner.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

const DELETE_ACTION_PREFIX = "DELETE_RESOURCE_SNAPSHOT";

export type DeleteSnapshotSuccess = { ok: true; record: VersionedSnapshotRecord; replay: boolean };
export type DeleteSnapshotResult =
  | DeleteSnapshotSuccess
  | { ok: false; kind: "NOT_FOUND" }
  | { ok: false; kind: "STALE_STATE"; current: VersionedSnapshotRecord }
  | { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" };

/**
 * Deletes one date's snapshot and re-syncs `ResourceBalance` to whichever
 * snapshot is now the latest (correctly "un-doing" the deleted one's
 * effect on the current balance if it had been the latest) — see
 * syncResourceBalanceFromLatestSnapshot. Other dates' snapshots, and their
 * own comparisons (computed live from stored data, never cached), are
 * automatically correct afterward with no separate recalculation step.
 */
export async function deleteResourceSnapshot(
  userId: string,
  localDate: LocalDate,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<DeleteSnapshotResult> {
  const action = `${DELETE_ACTION_PREFIX}:${localDate.year}-${localDate.month}-${localDate.day}`;
  const requestHash = computeRequestHash({ localDate, expectedVersion });
  const lookup = await lookupIdempotencyRecord<DeleteSnapshotSuccess>(userId, action, idempotencyKey, requestHash);
  if (lookup.status === "match") return { ...lookup.response, replay: true };
  if (lookup.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };

  try {
    return await prisma.$transaction(async (tx) => {
      const result = await deleteSnapshotWithVersion(tx, userId, localDate, expectedVersion);
      if (result.kind === "NOT_FOUND") return { ok: false, kind: "NOT_FOUND" };
      if (result.kind === "VERSION_CONFLICT") return { ok: false, kind: "STALE_STATE", current: result.current };

      await syncResourceBalanceFromLatestSnapshot(tx, userId);
      await createAuditLog(tx, userId, action, { deletedLocalDate: localDate });

      const response: DeleteSnapshotSuccess = { ok: true, record: result.record, replay: false };
      await createIdempotencyRecord(tx, userId, action, idempotencyKey, requestHash, response);
      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<DeleteSnapshotSuccess>(userId, action, idempotencyKey, requestHash);
      if (winner.status === "match") return { ...winner.response, replay: true };
      if (winner.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };
    }
    throw err;
  }
}
