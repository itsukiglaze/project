/**
 * Canonical wire-format DTOs + serializers for the resource-snapshot API —
 * same rationale and shape as calendar-dto.ts: one framework-free module
 * (no `next/server`, no `server-only`) importable by both the server route
 * handlers and client-side code, so the two can never independently drift.
 */
import type { CurrencyType, LocalDate } from "@/lib/calendar-math";
import { serializeLocalDate } from "@/lib/api/calendar-dto";
import type { CurrencyComparison } from "@/lib/resource-snapshot-math/comparison";

export type ResourceSnapshotItemDto = { currencyType: CurrencyType; amount: number };

export type ResourceSnapshotRecordDto = {
  id: string;
  localDate: string; // "YYYY-MM-DD"
  capturedAt: string; // ISO instant
  timezone: string;
  note: string | null;
  items: ResourceSnapshotItemDto[];
  version: number;
};

/** Structurally identical to CurrencyComparison — already JSON-safe (no LocalDate/Date fields), re-exported as the DTO shape for API consumers. */
export type CurrencyComparisonDto = CurrencyComparison;

export type ResourceSnapshotComparisonDto = {
  record: ResourceSnapshotRecordDto;
  comparison: CurrencyComparisonDto[];
  previousLocalDate: string | null;
};

type SnapshotRecordLike = {
  id: string;
  localDate: LocalDate;
  /**
   * A real `Date` on a fresh (non-replayed) response, but an already-ISO
   * string when this same record is read back out of an idempotency
   * replay — `IdempotencyRecord.responseSnapshot` is a Postgres `Json`
   * column, so storing a response containing a real `Date` round-trips it
   * through `JSON.stringify`/`JSON.parse` on the way back out, turning it
   * into a string. Both are valid inputs here; `toIsoString` below
   * normalizes either to the same wire string instead of assuming one.
   */
  capturedAt: Date | string;
  timezone: string;
  note: string | null;
  items: ResourceSnapshotItemDto[];
  version: number;
};

function toIsoString(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

export function serializeSnapshotRecord(record: SnapshotRecordLike): ResourceSnapshotRecordDto {
  return {
    id: record.id,
    localDate: serializeLocalDate(record.localDate),
    capturedAt: toIsoString(record.capturedAt),
    timezone: record.timezone,
    note: record.note,
    items: record.items,
    version: record.version,
  };
}

type SnapshotComparisonViewLike = {
  record: SnapshotRecordLike;
  comparison: CurrencyComparison[];
  previousLocalDate: LocalDate | null;
};

export function serializeSnapshotComparison(view: SnapshotComparisonViewLike): ResourceSnapshotComparisonDto {
  return {
    record: serializeSnapshotRecord(view.record),
    comparison: view.comparison,
    previousLocalDate: view.previousLocalDate ? serializeLocalDate(view.previousLocalDate) : null,
  };
}
