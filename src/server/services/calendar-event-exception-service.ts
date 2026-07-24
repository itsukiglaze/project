import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { BannerFamily } from "@/config/gacha";
import {
  expandRecurrence,
  formatLocalDate,
  type CurrencyType,
  type IncomeSource,
  type LocalDate,
} from "@/lib/calendar-math";
import { computeRequestHash } from "@/lib/idempotency-hash";
import { getSeriesById } from "@/server/repositories/calendar-event-series-repository";
import {
  upsertExceptionWithVersion,
  type ExceptionRecord,
  type ExceptionWriteFields,
} from "@/server/repositories/calendar-event-exception-repository";
import {
  createIdempotencyRecord,
  isIdempotencyConflict,
  lookupIdempotencyRecord,
} from "@/server/repositories/idempotency-repository";
import { createAuditLog } from "@/server/repositories/audit-log-repository";

export type ExceptionInput = {
  isCancelled: boolean;
  amountOverride: number | null;
  currencyTypeOverride: CurrencyType | null;
  sourceOverride: IncomeSource | null;
  bannerFamilyOverride: BannerFamily | null;
  noteOverride: string | null;
};

function validateExceptionInput(input: ExceptionInput): string[] {
  const errors: string[] = [];
  if (input.amountOverride !== null) {
    if (
      !Number.isInteger(input.amountOverride) ||
      !Number.isSafeInteger(input.amountOverride) ||
      input.amountOverride <= 0
    ) {
      errors.push(`amountOverride must be a positive safe integer, got ${String(input.amountOverride)}`);
    }
  }
  return errors;
}

function toWriteFields(input: ExceptionInput): ExceptionWriteFields {
  return {
    isCancelled: input.isCancelled,
    amountOverride: input.amountOverride,
    currencyTypeOverride: input.currencyTypeOverride,
    sourceOverride: input.sourceOverride,
    bannerFamilyOverride: input.bannerFamilyOverride,
    noteOverride: input.noteOverride,
  };
}

export type UpsertExceptionSuccess = { ok: true; record: ExceptionRecord; replay: boolean };
export type UpsertExceptionResult =
  | UpsertExceptionSuccess
  | { ok: false; kind: "VALIDATION_ERROR"; errors: string[] }
  | { ok: false; kind: "NOT_FOUND" }
  | { ok: false; kind: "INVALID_OCCURRENCE"; errors: string[] }
  | { ok: false; kind: "STALE_STATE"; current: ExceptionRecord }
  | { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" };

/**
 * Creates/updates/cancels a single occurrence override.
 *
 * `expectedVersion = 0` means "I believe no exception exists yet for this
 * occurrence" (create path); any other value targets an existing
 * exception (update path) — same optimistic-concurrency convention used
 * throughout Stage 4B/5B.
 */
export async function upsertOccurrenceException(
  userId: string,
  seriesId: string,
  occurrenceDate: LocalDate,
  input: ExceptionInput,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<UpsertExceptionResult> {
  const fieldErrors = validateExceptionInput(input);
  if (fieldErrors.length > 0) return { ok: false, kind: "VALIDATION_ERROR", errors: fieldErrors };

  const action = `UPSERT_CALENDAR_EXCEPTION:${seriesId}:${formatLocalDate(occurrenceDate)}`;
  const requestHash = computeRequestHash({ seriesId, occurrenceDate, input, expectedVersion });
  const lookup = await lookupIdempotencyRecord<UpsertExceptionSuccess>(
    userId,
    action,
    idempotencyKey,
    requestHash,
  );
  if (lookup.status === "match") return { ...lookup.response, replay: true };
  if (lookup.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };

  // Ownership: the series must belong to this user.
  const series = await getSeriesById(userId, seriesId);
  if (!series) return { ok: false, kind: "NOT_FOUND" };

  // The exception must target an actual scheduled occurrence of the
  // series' own rule — not an arbitrary date.
  const matchingDates = expandRecurrence(series.rule, occurrenceDate, occurrenceDate);
  if (matchingDates.length === 0) {
    return {
      ok: false,
      kind: "INVALID_OCCURRENCE",
      errors: [`${formatLocalDate(occurrenceDate)} is not a scheduled occurrence of this series`],
    };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const result = await upsertExceptionWithVersion(
        tx,
        seriesId,
        occurrenceDate,
        toWriteFields(input),
        expectedVersion,
      );
      if (result.kind === "NOT_FOUND") return { ok: false, kind: "NOT_FOUND" };
      if (result.kind === "VERSION_CONFLICT") return { ok: false, kind: "STALE_STATE", current: result.current };

      await createAuditLog(tx, userId, action, { updated: result.record });
      const response: UpsertExceptionSuccess = { ok: true, record: result.record, replay: false };
      await createIdempotencyRecord(tx, userId, action, idempotencyKey, requestHash, response);
      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<UpsertExceptionSuccess>(
        userId,
        action,
        idempotencyKey,
        requestHash,
      );
      if (winner.status === "match") return { ...winner.response, replay: true };
      if (winner.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };
    }
    throw err;
  }
}
