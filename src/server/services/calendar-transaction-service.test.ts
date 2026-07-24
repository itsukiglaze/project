import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencyType, IncomeSource, TransactionType } from "@/lib/calendar-math";

const mockCreateOneTimeTransaction = vi.fn();
const mockGetOneTimeTransactionById = vi.fn();
const mockUpdateOneTimeTransactionWithVersion = vi.fn();
const mockDeleteOneTimeTransactionWithVersion = vi.fn();
const mockLookupIdempotencyRecord = vi.fn();
const mockCreateIdempotencyRecord = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}) },
}));

vi.mock("@/server/repositories/calendar-transaction-repository", () => ({
  createOneTimeTransaction: (...args: unknown[]) => mockCreateOneTimeTransaction(...args),
  getOneTimeTransactionById: (...args: unknown[]) => mockGetOneTimeTransactionById(...args),
  updateOneTimeTransactionWithVersion: (...args: unknown[]) => mockUpdateOneTimeTransactionWithVersion(...args),
  deleteOneTimeTransactionWithVersion: (...args: unknown[]) => mockDeleteOneTimeTransactionWithVersion(...args),
}));

vi.mock("@/server/repositories/idempotency-repository", () => ({
  lookupIdempotencyRecord: (...args: unknown[]) => mockLookupIdempotencyRecord(...args),
  createIdempotencyRecord: (...args: unknown[]) => mockCreateIdempotencyRecord(...args),
  isIdempotencyConflict: (err: unknown) => (err as { code?: string })?.code === "P2002",
}));

vi.mock("@/server/repositories/audit-log-repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

import {
  createOneTimeCalendarTransaction,
  deleteOneTimeCalendarTransaction,
  updateOneTimeCalendarTransaction,
  type TransactionInput,
} from "./calendar-transaction-service";

function d(year: number, month: number, day: number) {
  return { year, month, day };
}

function fakeP2002() {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

function baseInput(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    localDate: d(2026, 1, 5),
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 300,
    source: IncomeSource.EVENT,
    bannerFamily: null,
    note: "compensation",
    timezone: "Europe/Berlin",
    ...overrides,
  };
}

function transactionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "tx-1",
    userId: "user-1",
    localDate: d(2026, 1, 5),
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 300,
    source: IncomeSource.EVENT,
    bannerFamily: null,
    note: "compensation",
    seriesId: null,
    occurrenceDate: null,
    version: 1,
    ...overrides,
  };
}

describe("createOneTimeCalendarTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
  });

  it("creates a valid one-time transaction", async () => {
    mockCreateOneTimeTransaction.mockResolvedValue(transactionRecord());
    const result = await createOneTimeCalendarTransaction("user-1", baseInput(), "key-12345678");
    expect(result.ok).toBe(true);
  });

  it("rejects amount <= 0", async () => {
    const result = await createOneTimeCalendarTransaction("user-1", baseInput({ amount: 0 }), "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("VALIDATION_ERROR");
    expect(mockCreateOneTimeTransaction).not.toHaveBeenCalled();
  });

  it("rejects an EXPENSE with a source (not applicable)", async () => {
    const result = await createOneTimeCalendarTransaction(
      "user-1",
      baseInput({ type: TransactionType.EXPENSE, currencyType: CurrencyType.MASTER_TAPE, source: IncomeSource.OTHER }),
      "key-12345678",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("VALIDATION_ERROR");
  });

  it("allows PULL for one-time transactions (unlike series)", async () => {
    mockCreateOneTimeTransaction.mockResolvedValue(transactionRecord({ type: TransactionType.PULL }));
    const result = await createOneTimeCalendarTransaction(
      "user-1",
      baseInput({
        type: TransactionType.PULL,
        currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE,
        source: null,
        bannerFamily: "EXCLUSIVE_AGENT" as never,
      }),
      "key-12345678",
    );
    expect(result.ok).toBe(true);
  });

  describe("idempotency & races", () => {
    it("same key, same payload -> replay", async () => {
      const stored = { ok: true, record: transactionRecord(), replay: false };
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "match", response: stored });
      const result = await createOneTimeCalendarTransaction("user-1", baseInput(), "key-12345678");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
      expect(mockCreateOneTimeTransaction).not.toHaveBeenCalled();
    });

    it("same key, different payload -> IDEMPOTENCY_KEY_REUSED", async () => {
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "mismatch" });
      const result = await createOneTimeCalendarTransaction("user-1", baseInput(), "key-12345678");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
    });

    it("concurrent identical requests -> loser replays winner", async () => {
      mockCreateOneTimeTransaction.mockResolvedValue(transactionRecord());
      const winner = { ok: true, record: transactionRecord(), replay: false };
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "match", response: winner });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await createOneTimeCalendarTransaction("user-1", baseInput(), "key-12345678");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
    });

    it("concurrent mismatched requests -> loser gets IDEMPOTENCY_KEY_REUSED", async () => {
      mockCreateOneTimeTransaction.mockResolvedValue(transactionRecord());
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "mismatch" });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await createOneTimeCalendarTransaction("user-1", baseInput(), "key-12345678");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
    });
  });

  describe("transaction rollback", () => {
    it("propagates an audit-log failure without recording idempotency", async () => {
      mockCreateOneTimeTransaction.mockResolvedValue(transactionRecord());
      mockCreateAuditLog.mockRejectedValue(new Error("audit log failed"));

      await expect(createOneTimeCalendarTransaction("user-1", baseInput(), "key-12345678")).rejects.toThrow(
        "audit log failed",
      );
      expect(mockCreateIdempotencyRecord).not.toHaveBeenCalled();
    });
  });
});

describe("updateOneTimeCalendarTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
  });

  it("updates a one-time transaction the user owns", async () => {
    mockGetOneTimeTransactionById.mockResolvedValue(transactionRecord());
    mockUpdateOneTimeTransactionWithVersion.mockResolvedValue({
      kind: "OK",
      record: transactionRecord({ version: 2 }),
    });
    const result = await updateOneTimeCalendarTransaction("user-1", "tx-1", baseInput(), 1, "key-12345678");
    expect(result.ok).toBe(true);
  });

  it("returns NOT_FOUND when the transaction doesn't belong to this user (ownership isolation)", async () => {
    mockGetOneTimeTransactionById.mockResolvedValue(null);
    const result = await updateOneTimeCalendarTransaction("attacker", "someone-elses-tx", baseInput(), 1, "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("NOT_FOUND");
    expect(mockUpdateOneTimeTransactionWithVersion).not.toHaveBeenCalled();
  });

  it("refuses to edit a materialized series transaction via the one-time endpoint", async () => {
    mockGetOneTimeTransactionById.mockResolvedValue(transactionRecord({ seriesId: "series-1", occurrenceDate: d(2026, 1, 5) }));
    const result = await updateOneTimeCalendarTransaction("user-1", "tx-1", baseInput(), 1, "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("VALIDATION_ERROR");
    expect(mockUpdateOneTimeTransactionWithVersion).not.toHaveBeenCalled();
  });

  it("returns STALE_STATE on version conflict", async () => {
    mockGetOneTimeTransactionById.mockResolvedValue(transactionRecord());
    mockUpdateOneTimeTransactionWithVersion.mockResolvedValue({
      kind: "VERSION_CONFLICT",
      current: transactionRecord({ version: 4 }),
    });
    const result = await updateOneTimeCalendarTransaction("user-1", "tx-1", baseInput(), 1, "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("STALE_STATE");
  });
});

describe("deleteOneTimeCalendarTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
  });

  it("deletes a one-time transaction the user owns", async () => {
    mockGetOneTimeTransactionById.mockResolvedValue(transactionRecord());
    mockDeleteOneTimeTransactionWithVersion.mockResolvedValue({ kind: "OK", record: transactionRecord() });
    const result = await deleteOneTimeCalendarTransaction("user-1", "tx-1", 1, "key-12345678");
    expect(result.ok).toBe(true);
  });

  it("refuses to delete a materialized series transaction via the one-time endpoint", async () => {
    mockGetOneTimeTransactionById.mockResolvedValue(transactionRecord({ seriesId: "series-1", occurrenceDate: d(2026, 1, 5) }));
    const result = await deleteOneTimeCalendarTransaction("user-1", "tx-1", 1, "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("VALIDATION_ERROR");
    expect(mockDeleteOneTimeTransactionWithVersion).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a nonexistent/foreign transaction (ownership isolation)", async () => {
    mockGetOneTimeTransactionById.mockResolvedValue(null);
    const result = await deleteOneTimeCalendarTransaction("attacker", "someone-elses-tx", 1, "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("NOT_FOUND");
  });

  it("preserves future materialized transactions belonging to OTHER series/ids untouched (this call only ever targets its own id)", async () => {
    mockGetOneTimeTransactionById.mockResolvedValue(transactionRecord({ id: "tx-1" }));
    mockDeleteOneTimeTransactionWithVersion.mockResolvedValue({ kind: "OK", record: transactionRecord({ id: "tx-1" }) });
    await deleteOneTimeCalendarTransaction("user-1", "tx-1", 1, "key-12345678");
    expect(mockDeleteOneTimeTransactionWithVersion).toHaveBeenCalledWith(expect.anything(), "user-1", "tx-1", 1);
  });
});
