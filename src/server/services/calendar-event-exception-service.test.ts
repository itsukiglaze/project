import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecurrenceEndType, RecurrenceFrequency, TransactionType, CurrencyType, IncomeSource } from "@/lib/calendar-math";

const mockGetSeriesById = vi.fn();
const mockUpsertExceptionWithVersion = vi.fn();
const mockLookupIdempotencyRecord = vi.fn();
const mockCreateIdempotencyRecord = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}) },
}));

vi.mock("@/server/repositories/calendar-event-series-repository", () => ({
  getSeriesById: (...args: unknown[]) => mockGetSeriesById(...args),
}));

vi.mock("@/server/repositories/calendar-event-exception-repository", () => ({
  upsertExceptionWithVersion: (...args: unknown[]) => mockUpsertExceptionWithVersion(...args),
}));

vi.mock("@/server/repositories/idempotency-repository", () => ({
  lookupIdempotencyRecord: (...args: unknown[]) => mockLookupIdempotencyRecord(...args),
  createIdempotencyRecord: (...args: unknown[]) => mockCreateIdempotencyRecord(...args),
  isIdempotencyConflict: (err: unknown) => (err as { code?: string })?.code === "P2002",
}));

vi.mock("@/server/repositories/audit-log-repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

import { upsertOccurrenceException, type ExceptionInput } from "./calendar-event-exception-service";

function d(year: number, month: number, day: number) {
  return { year, month, day };
}

function fakeP2002() {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

function dailySeries() {
  return {
    id: "series-1",
    userId: "user-1",
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 60,
    source: IncomeSource.DAILY,
    bannerFamily: null,
    note: null,
    timezone: "Europe/Berlin",
    rule: {
      frequency: RecurrenceFrequency.DAILY,
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: null,
      startDate: d(2026, 1, 1),
      endType: RecurrenceEndType.NEVER,
      endDate: null,
      occurrenceCount: null,
    },
    isActive: true,
    splitFromSeriesId: null,
    version: 1,
  };
}

function cancelInput(): ExceptionInput {
  return {
    isCancelled: true,
    amountOverride: null,
    currencyTypeOverride: null,
    sourceOverride: null,
    bannerFamilyOverride: null,
    noteOverride: null,
  };
}

function exceptionRecord(overrides: Record<string, unknown> = {}) {
  return {
    seriesId: "series-1",
    occurrenceDate: d(2026, 1, 5),
    isCancelled: true,
    amountOverride: null,
    currencyTypeOverride: null,
    sourceOverride: null,
    bannerFamilyOverride: null,
    noteOverride: null,
    version: 1,
    ...overrides,
  };
}

describe("upsertOccurrenceException", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
    mockUpsertExceptionWithVersion.mockResolvedValue({ kind: "OK", record: exceptionRecord() });
  });

  it("creates a cancellation exception for a valid occurrence", async () => {
    mockGetSeriesById.mockResolvedValue(dailySeries());
    mockUpsertExceptionWithVersion.mockResolvedValue({ kind: "OK", record: exceptionRecord() });

    const result = await upsertOccurrenceException(
      "user-1",
      "series-1",
      d(2026, 1, 5),
      cancelInput(),
      0,
      "key-12345678",
    );
    expect(result.ok).toBe(true);
  });

  it("returns NOT_FOUND when the series doesn't belong to this user (ownership isolation)", async () => {
    mockGetSeriesById.mockResolvedValue(null);
    const result = await upsertOccurrenceException(
      "attacker",
      "someone-elses-series",
      d(2026, 1, 5),
      cancelInput(),
      0,
      "key-12345678",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("NOT_FOUND");
    expect(mockUpsertExceptionWithVersion).not.toHaveBeenCalled();
  });

  it("rejects a date that is not an actual scheduled occurrence (INVALID_OCCURRENCE)", async () => {
    mockGetSeriesById.mockResolvedValue({
      ...dailySeries(),
      rule: { ...dailySeries().rule, endType: RecurrenceEndType.UNTIL_DATE, endDate: d(2026, 1, 3) },
    });
    // Jan 10 is well past the series' own endDate of Jan 3.
    const result = await upsertOccurrenceException(
      "user-1",
      "series-1",
      d(2026, 1, 10),
      cancelInput(),
      0,
      "key-12345678",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("INVALID_OCCURRENCE");
  });

  it("rejects an invalid amountOverride (VALIDATION_ERROR)", async () => {
    const result = await upsertOccurrenceException(
      "user-1",
      "series-1",
      d(2026, 1, 5),
      { ...cancelInput(), isCancelled: false, amountOverride: -5 },
      0,
      "key-12345678",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("VALIDATION_ERROR");
    expect(mockGetSeriesById).not.toHaveBeenCalled();
  });

  it("returns STALE_STATE on a version conflict", async () => {
    mockGetSeriesById.mockResolvedValue(dailySeries());
    mockUpsertExceptionWithVersion.mockResolvedValue({
      kind: "VERSION_CONFLICT",
      current: exceptionRecord({ version: 3 }),
    });
    const result = await upsertOccurrenceException(
      "user-1",
      "series-1",
      d(2026, 1, 5),
      cancelInput(),
      1,
      "key-12345678",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("STALE_STATE");
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  describe("idempotency & races", () => {
    it("same key, same payload -> replay", async () => {
      const stored = { ok: true, record: exceptionRecord(), replay: false };
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "match", response: stored });

      const result = await upsertOccurrenceException(
        "user-1",
        "series-1",
        d(2026, 1, 5),
        cancelInput(),
        0,
        "key-12345678",
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
      expect(mockGetSeriesById).not.toHaveBeenCalled();
    });

    it("same key, different payload -> IDEMPOTENCY_KEY_REUSED", async () => {
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "mismatch" });
      const result = await upsertOccurrenceException(
        "user-1",
        "series-1",
        d(2026, 1, 5),
        cancelInput(),
        0,
        "key-12345678",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
    });

    it("concurrent identical requests -> loser replays winner", async () => {
      mockGetSeriesById.mockResolvedValue(dailySeries());
      const winner = { ok: true, record: exceptionRecord(), replay: false };
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "match", response: winner });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await upsertOccurrenceException(
        "user-1",
        "series-1",
        d(2026, 1, 5),
        cancelInput(),
        0,
        "key-12345678",
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
    });

    it("concurrent mismatched requests -> loser gets IDEMPOTENCY_KEY_REUSED", async () => {
      mockGetSeriesById.mockResolvedValue(dailySeries());
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "mismatch" });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await upsertOccurrenceException(
        "user-1",
        "series-1",
        d(2026, 1, 5),
        cancelInput(),
        0,
        "key-12345678",
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
    });
  });

  describe("transaction rollback", () => {
    it("propagates an audit-log failure without recording idempotency", async () => {
      mockGetSeriesById.mockResolvedValue(dailySeries());
      mockUpsertExceptionWithVersion.mockResolvedValue({ kind: "OK", record: exceptionRecord() });
      mockCreateAuditLog.mockRejectedValue(new Error("audit log failed"));

      await expect(
        upsertOccurrenceException("user-1", "series-1", d(2026, 1, 5), cancelInput(), 0, "key-12345678"),
      ).rejects.toThrow("audit log failed");
      expect(mockCreateIdempotencyRecord).not.toHaveBeenCalled();
    });
  });
});
