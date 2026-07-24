import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { BannerFamily } from "@/config/gacha";
import {
  validateTransactionFieldsByType,
  type CurrencyType,
  type IncomeSource,
  type LocalDate,
  type TransactionType,
} from "@/lib/calendar-math";
import { computeRequestHash } from "@/lib/idempotency-hash";
import {
  createOneTimeTransaction as createTransactionRow,
  deleteOneTimeTransactionWithVersion,
  getOneTimeTransactionById,
  updateOneTimeTransactionWithVersion,
  type OneTimeTransactionFields,
  type TransactionRecord,
} from "@/server/repositories/calendar-transaction-repository";
import {
  createIdempotencyRecord,
  isIdempotencyConflict,
  lookupIdempotencyRecord,
} from "@/server/repositories/idempotency-repository";
import { createAuditLog } from "@/server/repositories/audit-log-repository";

export type TransactionInput = {
  localDate: LocalDate;
  type: TransactionType;
  currencyType: CurrencyType | null;
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
  timezone: string;
};

const MAX_TRANSACTION_AMOUNT = 1_000_000_000;

function validateTransactionInput(input: TransactionInput): string[] {
  const errors: string[] = [];
  if (
    !Number.isInteger(input.amount) ||
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    input.amount > MAX_TRANSACTION_AMOUNT
  ) {
    errors.push(
      `amount must be a positive safe integer up to ${MAX_TRANSACTION_AMOUNT}, got ${String(input.amount)}`,
    );
  }
  const fieldResult = validateTransactionFieldsByType({
    type: input.type,
    currencyType: input.currencyType,
    source: input.source,
    bannerFamily: input.bannerFamily,
  });
  if (!fieldResult.ok) errors.push(...fieldResult.errors);
  return errors;
}

function toWriteFields(input: TransactionInput): OneTimeTransactionFields {
  return {
    localDate: input.localDate,
    type: input.type,
    currencyType: input.currencyType,
    amount: input.amount,
    source: input.source,
    bannerFamily: input.bannerFamily,
    note: input.note,
    timezone: input.timezone,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const CREATE_ACTION = "CREATE_CALENDAR_TRANSACTION";

export type CreateTransactionSuccess = { ok: true; record: TransactionRecord; replay: boolean };
export type CreateTransactionResult =
  | CreateTransactionSuccess
  | { ok: false; kind: "VALIDATION_ERROR"; errors: string[] }
  | { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" };

export async function createOneTimeCalendarTransaction(
  userId: string,
  input: TransactionInput,
  idempotencyKey: string,
): Promise<CreateTransactionResult> {
  const errors = validateTransactionInput(input);
  if (errors.length > 0) return { ok: false, kind: "VALIDATION_ERROR", errors };

  const requestHash = computeRequestHash({ input });
  const lookup = await lookupIdempotencyRecord<CreateTransactionSuccess>(
    userId,
    CREATE_ACTION,
    idempotencyKey,
    requestHash,
  );
  if (lookup.status === "match") return { ...lookup.response, replay: true };
  if (lookup.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };

  try {
    return await prisma.$transaction(async (tx) => {
      const record = await createTransactionRow(tx, userId, toWriteFields(input));
      await createAuditLog(tx, userId, CREATE_ACTION, { created: record });
      const response: CreateTransactionSuccess = { ok: true, record, replay: false };
      await createIdempotencyRecord(tx, userId, CREATE_ACTION, idempotencyKey, requestHash, response);
      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<CreateTransactionSuccess>(
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
// Edit
// ---------------------------------------------------------------------------

export type UpdateTransactionSuccess = { ok: true; record: TransactionRecord; replay: boolean };
export type UpdateTransactionResult =
  | UpdateTransactionSuccess
  | { ok: false; kind: "VALIDATION_ERROR"; errors: string[] }
  | { ok: false; kind: "NOT_FOUND" }
  | { ok: false; kind: "STALE_STATE"; current: TransactionRecord }
  | { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" };

/**
 * Only ever edits a ONE-TIME transaction (seriesId === null). A row that
 * materializes a series occurrence is not editable through this path in
 * MVP — that's a series/exception concern (see
 * calendar-event-exception-service.ts), not a plain transaction edit.
 */
export async function updateOneTimeCalendarTransaction(
  userId: string,
  transactionId: string,
  input: TransactionInput,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<UpdateTransactionResult> {
  const errors = validateTransactionInput(input);
  if (errors.length > 0) return { ok: false, kind: "VALIDATION_ERROR", errors };

  const action = `UPDATE_CALENDAR_TRANSACTION:${transactionId}`;
  const requestHash = computeRequestHash({ transactionId, input, expectedVersion });
  const lookup = await lookupIdempotencyRecord<UpdateTransactionSuccess>(
    userId,
    action,
    idempotencyKey,
    requestHash,
  );
  if (lookup.status === "match") return { ...lookup.response, replay: true };
  if (lookup.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };

  const existing = await getOneTimeTransactionById(userId, transactionId);
  if (!existing) return { ok: false, kind: "NOT_FOUND" };
  if (existing.seriesId !== null) {
    return {
      ok: false,
      kind: "VALIDATION_ERROR",
      errors: [
        "This transaction materializes a recurring series occurrence and cannot be edited as a one-time transaction",
      ],
    };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const result = await updateOneTimeTransactionWithVersion(
        tx,
        userId,
        transactionId,
        toWriteFields(input),
        expectedVersion,
      );
      if (result.kind === "NOT_FOUND") return { ok: false, kind: "NOT_FOUND" };
      if (result.kind === "VERSION_CONFLICT") return { ok: false, kind: "STALE_STATE", current: result.current };

      await createAuditLog(tx, userId, action, { updated: result.record });
      const response: UpdateTransactionSuccess = { ok: true, record: result.record, replay: false };
      await createIdempotencyRecord(tx, userId, action, idempotencyKey, requestHash, response);
      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<UpdateTransactionSuccess>(
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

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export type DeleteTransactionSuccess = { ok: true; record: TransactionRecord; replay: boolean };
export type DeleteTransactionResult =
  | DeleteTransactionSuccess
  | { ok: false; kind: "VALIDATION_ERROR"; errors: string[] }
  | { ok: false; kind: "NOT_FOUND" }
  | { ok: false; kind: "STALE_STATE"; current: TransactionRecord }
  | { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" };

export async function deleteOneTimeCalendarTransaction(
  userId: string,
  transactionId: string,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<DeleteTransactionResult> {
  const action = `DELETE_CALENDAR_TRANSACTION:${transactionId}`;
  const requestHash = computeRequestHash({ transactionId, expectedVersion });
  const lookup = await lookupIdempotencyRecord<DeleteTransactionSuccess>(
    userId,
    action,
    idempotencyKey,
    requestHash,
  );
  if (lookup.status === "match") return { ...lookup.response, replay: true };
  if (lookup.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };

  const existing = await getOneTimeTransactionById(userId, transactionId);
  if (!existing) return { ok: false, kind: "NOT_FOUND" };
  if (existing.seriesId !== null) {
    return {
      ok: false,
      kind: "VALIDATION_ERROR",
      errors: [
        "This transaction materializes a recurring series occurrence and cannot be deleted as a one-time transaction",
      ],
    };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const result = await deleteOneTimeTransactionWithVersion(tx, userId, transactionId, expectedVersion);
      if (result.kind === "NOT_FOUND") return { ok: false, kind: "NOT_FOUND" };
      if (result.kind === "VERSION_CONFLICT") return { ok: false, kind: "STALE_STATE", current: result.current };

      await createAuditLog(tx, userId, action, { deleted: result.record.id });
      const response: DeleteTransactionSuccess = { ok: true, record: result.record, replay: false };
      await createIdempotencyRecord(tx, userId, action, idempotencyKey, requestHash, response);
      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<DeleteTransactionSuccess>(
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
