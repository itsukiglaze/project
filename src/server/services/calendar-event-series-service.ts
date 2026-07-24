import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { BannerFamily } from "@/config/gacha";
import {
  addDays,
  compareLocalDate,
  expandRecurrence,
  formatLocalDate,
  validateRecurrenceRule,
  validateSeriesTemplate,
  type CurrencyType,
  type IncomeSource,
  type LocalDate,
  type RecurrenceRule,
  type RecurringTransactionType,
} from "@/lib/calendar-math";
import { computeRequestHash } from "@/lib/idempotency-hash";
import {
  closeSeriesAtDate,
  createSeries as createSeriesRow,
  getSeriesById,
  updateSeriesWithVersion,
  softDeleteSeriesWithVersion,
  type SeriesRecord,
  type SeriesWriteFields,
} from "@/server/repositories/calendar-event-series-repository";
import { reassignExceptionsFromDate } from "@/server/repositories/calendar-event-exception-repository";
import {
  createIdempotencyRecord,
  isIdempotencyConflict,
  lookupIdempotencyRecord,
} from "@/server/repositories/idempotency-repository";
import { createAuditLog } from "@/server/repositories/audit-log-repository";

export type SeriesInput = {
  type: RecurringTransactionType;
  currencyType: CurrencyType | null;
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
  rule: RecurrenceRule;
};

function validateSeriesInput(input: SeriesInput): string[] {
  const errors: string[] = [];
  const ruleResult = validateRecurrenceRule(input.rule);
  if (!ruleResult.ok) errors.push(...ruleResult.errors);
  const templateResult = validateSeriesTemplate({
    type: input.type,
    currencyType: input.currencyType,
    amount: input.amount,
    source: input.source,
    bannerFamily: input.bannerFamily,
    note: input.note,
  });
  if (!templateResult.ok) errors.push(...templateResult.errors);
  return errors;
}

function toWriteFields(input: SeriesInput): SeriesWriteFields {
  return {
    type: input.type,
    currencyType: input.currencyType,
    amount: input.amount,
    source: input.source,
    bannerFamily: input.bannerFamily,
    note: input.note,
    rule: input.rule,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const CREATE_ACTION = "CREATE_CALENDAR_SERIES";

export type CreateSeriesSuccess = { ok: true; record: SeriesRecord; replay: boolean };
export type CreateSeriesResult =
  | CreateSeriesSuccess
  | { ok: false; kind: "VALIDATION_ERROR"; errors: string[] }
  | { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" };

export async function createEventSeries(
  userId: string,
  input: SeriesInput,
  timezone: string,
  idempotencyKey: string,
): Promise<CreateSeriesResult> {
  const errors = validateSeriesInput(input);
  if (errors.length > 0) return { ok: false, kind: "VALIDATION_ERROR", errors };

  const requestHash = computeRequestHash({ input, timezone });
  const lookup = await lookupIdempotencyRecord<CreateSeriesSuccess>(userId, CREATE_ACTION, idempotencyKey, requestHash);
  if (lookup.status === "match") return { ...lookup.response, replay: true };
  if (lookup.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };

  try {
    return await prisma.$transaction(async (tx) => {
      const record = await createSeriesRow(tx, userId, toWriteFields(input), timezone, null);
      await createAuditLog(tx, userId, CREATE_ACTION, { created: record });
      const response: CreateSeriesSuccess = { ok: true, record, replay: false };
      await createIdempotencyRecord(tx, userId, CREATE_ACTION, idempotencyKey, requestHash, response);
      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<CreateSeriesSuccess>(
        userId,
        CREATE_ACTION,
        idempotencyKey,
        requestHash,
      );
      if (winner.status === "match") return { ...winner.response, replay: true };
      if (winner.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Edit entire series
// ---------------------------------------------------------------------------

export type UpdateSeriesSuccess = { ok: true; record: SeriesRecord; replay: boolean };
export type UpdateSeriesResult =
  | UpdateSeriesSuccess
  | { ok: false; kind: "VALIDATION_ERROR"; errors: string[] }
  | { ok: false; kind: "NOT_FOUND" }
  | { ok: false; kind: "STALE_STATE"; current: SeriesRecord }
  | { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" };

/**
 * Edits the WHOLE series in place. Per decision: this never rewrites
 * already-materialized CalendarTransaction rows (there is no code path
 * here that touches that table at all) — only the series' own template
 * and rule change, which affects future VIRTUAL occurrences going
 * forward. Past history is a separate, immutable fact.
 */
export async function updateEventSeries(
  userId: string,
  seriesId: string,
  input: SeriesInput,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<UpdateSeriesResult> {
  const errors = validateSeriesInput(input);
  if (errors.length > 0) return { ok: false, kind: "VALIDATION_ERROR", errors };

  const action = `UPDATE_CALENDAR_SERIES:${seriesId}`;
  const requestHash = computeRequestHash({ seriesId, input, expectedVersion });
  const lookup = await lookupIdempotencyRecord<UpdateSeriesSuccess>(userId, action, idempotencyKey, requestHash);
  if (lookup.status === "match") return { ...lookup.response, replay: true };
  if (lookup.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };

  try {
    return await prisma.$transaction(async (tx) => {
      const result = await updateSeriesWithVersion(tx, userId, seriesId, toWriteFields(input), expectedVersion);
      if (result.kind === "NOT_FOUND") return { ok: false, kind: "NOT_FOUND" };
      if (result.kind === "VERSION_CONFLICT") {
        return { ok: false, kind: "STALE_STATE", current: result.current };
      }

      await createAuditLog(tx, userId, action, { updated: result.record });
      const response: UpdateSeriesSuccess = { ok: true, record: result.record, replay: false };
      await createIdempotencyRecord(tx, userId, action, idempotencyKey, requestHash, response);
      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<UpdateSeriesSuccess>(userId, action, idempotencyKey, requestHash);
      if (winner.status === "match") return { ...winner.response, replay: true };
      if (winner.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Soft delete
// ---------------------------------------------------------------------------

export type DeleteSeriesSuccess = { ok: true; record: SeriesRecord; replay: boolean };
export type DeleteSeriesResult =
  | DeleteSeriesSuccess
  | { ok: false; kind: "NOT_FOUND" }
  | { ok: false; kind: "STALE_STATE"; current: SeriesRecord }
  | { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" };

/**
 * Soft delete only (isActive=false) — never removes the row, never
 * touches its exceptions or any materialized CalendarTransaction. Future
 * virtual occurrences simply stop being generated (see
 * calendar-occurrence-service.ts, which only expands isActive=true series).
 */
export async function deleteEventSeries(
  userId: string,
  seriesId: string,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<DeleteSeriesResult> {
  const action = `DELETE_CALENDAR_SERIES:${seriesId}`;
  const requestHash = computeRequestHash({ seriesId, expectedVersion });
  const lookup = await lookupIdempotencyRecord<DeleteSeriesSuccess>(userId, action, idempotencyKey, requestHash);
  if (lookup.status === "match") return { ...lookup.response, replay: true };
  if (lookup.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };

  try {
    return await prisma.$transaction(async (tx) => {
      const result = await softDeleteSeriesWithVersion(tx, userId, seriesId, expectedVersion);
      if (result.kind === "NOT_FOUND") return { ok: false, kind: "NOT_FOUND" };
      if (result.kind === "VERSION_CONFLICT") {
        return { ok: false, kind: "STALE_STATE", current: result.current };
      }

      await createAuditLog(tx, userId, action, { deactivated: result.record.id });
      const response: DeleteSeriesSuccess = { ok: true, record: result.record, replay: false };
      await createIdempotencyRecord(tx, userId, action, idempotencyKey, requestHash, response);
      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<DeleteSeriesSuccess>(userId, action, idempotencyKey, requestHash);
      if (winner.status === "match") return { ...winner.response, replay: true };
      if (winner.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Split ("this and future occurrences")
// ---------------------------------------------------------------------------

export type SplitSeriesSuccess =
  | { ok: true; mode: "IN_PLACE_EDIT"; record: SeriesRecord; replay: boolean }
  | {
      ok: true;
      mode: "SPLIT";
      oldSeries: SeriesRecord;
      newSeries: SeriesRecord;
      reassignedExceptionCount: number;
      replay: boolean;
    };

export type SplitSeriesResult =
  | SplitSeriesSuccess
  | { ok: false; kind: "VALIDATION_ERROR"; errors: string[] }
  | { ok: false; kind: "NOT_FOUND" }
  | { ok: false; kind: "STALE_STATE"; current: SeriesRecord }
  | { ok: false; kind: "INVALID_OCCURRENCE"; errors: string[] }
  | { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" };

/**
 * "This and future occurrences" edit.
 *
 * - If `splitDate` is the series' OWN first occurrence, splitting would
 *   produce a zero-length predecessor — collapses to an in-place edit of
 *   the existing series instead (no split history recorded).
 * - Otherwise: the OLD series is closed (endType=UNTIL_DATE, endDate =
 *   splitDate - 1 day); a NEW series is created starting at `splitDate`
 *   with `newInput`, linked via `splitFromSeriesId`; exceptions dated
 *   on/after `splitDate` are reassigned to the new series (future
 *   occurrences of intent that predate the split stay with the old one);
 *   materialized CalendarTransaction rows are NEVER reassigned or
 *   deleted, even for future dates — they keep pointing at the (now
 *   closed) predecessor series, preserving what was actually recorded.
 *
 * All of the above is one transaction, one audit log entry, one
 * idempotency record.
 */
export async function splitEventSeries(
  userId: string,
  seriesId: string,
  splitDate: LocalDate,
  newInput: SeriesInput,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<SplitSeriesResult> {
  const errors = validateSeriesInput(newInput);
  if (errors.length > 0) return { ok: false, kind: "VALIDATION_ERROR", errors };

  const action = `SPLIT_CALENDAR_SERIES:${seriesId}`;
  const requestHash = computeRequestHash({ seriesId, splitDate, newInput, expectedVersion });
  const lookup = await lookupIdempotencyRecord<SplitSeriesSuccess>(userId, action, idempotencyKey, requestHash);
  if (lookup.status === "match") return { ...lookup.response, replay: true };
  if (lookup.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };

  const oldSeries = await getSeriesById(userId, seriesId);
  if (!oldSeries) return { ok: false, kind: "NOT_FOUND" };

  // splitDate must actually be a scheduled occurrence of the OLD rule.
  const matchingDates = expandRecurrence(oldSeries.rule, splitDate, splitDate);
  if (matchingDates.length === 0) {
    return {
      ok: false,
      kind: "INVALID_OCCURRENCE",
      errors: [`${formatLocalDate(splitDate)} is not a scheduled occurrence of this series`],
    };
  }

  const isFirstOccurrence = compareLocalDate(splitDate, oldSeries.rule.startDate) === 0;

  try {
    return await prisma.$transaction(async (tx) => {
      if (isFirstOccurrence) {
        const result = await updateSeriesWithVersion(tx, userId, seriesId, toWriteFields(newInput), expectedVersion);
        if (result.kind === "NOT_FOUND") return { ok: false, kind: "NOT_FOUND" };
        if (result.kind === "VERSION_CONFLICT") return { ok: false, kind: "STALE_STATE", current: result.current };

        await createAuditLog(tx, userId, action, { mode: "IN_PLACE_EDIT", updated: result.record });
        const response: SplitSeriesSuccess = { ok: true, mode: "IN_PLACE_EDIT", record: result.record, replay: false };
        await createIdempotencyRecord(tx, userId, action, idempotencyKey, requestHash, response);
        return response;
      }

      const closeResult = await closeSeriesAtDate(tx, userId, seriesId, addDays(splitDate, -1), expectedVersion);
      if (closeResult.kind === "NOT_FOUND") return { ok: false, kind: "NOT_FOUND" };
      if (closeResult.kind === "VERSION_CONFLICT") {
        return { ok: false, kind: "STALE_STATE", current: closeResult.current };
      }

      const newSeriesInput: SeriesInput = { ...newInput, rule: { ...newInput.rule, startDate: splitDate } };
      const newSeries = await createSeriesRow(
        tx,
        userId,
        toWriteFields(newSeriesInput),
        oldSeries.timezone,
        seriesId,
      );

      const { reassignedCount } = await reassignExceptionsFromDate(tx, seriesId, newSeries.id, splitDate);

      await createAuditLog(tx, userId, action, {
        mode: "SPLIT",
        oldSeriesId: seriesId,
        newSeriesId: newSeries.id,
        splitDate,
        reassignedExceptionCount: reassignedCount,
      });

      const response: SplitSeriesSuccess = {
        ok: true,
        mode: "SPLIT",
        oldSeries: closeResult.record,
        newSeries,
        reassignedExceptionCount: reassignedCount,
        replay: false,
      };
      await createIdempotencyRecord(tx, userId, action, idempotencyKey, requestHash, response);
      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<SplitSeriesSuccess>(userId, action, idempotencyKey, requestHash);
      if (winner.status === "match") return { ...winner.response, replay: true };
      if (winner.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };
    }
    throw err;
  }
}
