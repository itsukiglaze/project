import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecurrenceEndType, RecurrenceFrequency, TransactionType, CurrencyType, IncomeSource } from "@/lib/calendar-math";

const mockGetSeriesById = vi.fn();
const mockCreateSeries = vi.fn();
const mockUpdateSeriesWithVersion = vi.fn();
const mockCloseSeriesAtDate = vi.fn();
const mockSoftDeleteSeriesWithVersion = vi.fn();
const mockReassignExceptionsFromDate = vi.fn();
const mockLookupIdempotencyRecord = vi.fn();
const mockCreateIdempotencyRecord = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}) },
}));

vi.mock("@/server/repositories/calendar-event-series-repository", () => ({
  getSeriesById: (...args: unknown[]) => mockGetSeriesById(...args),
  createSeries: (...args: unknown[]) => mockCreateSeries(...args),
  updateSeriesWithVersion: (...args: unknown[]) => mockUpdateSeriesWithVersion(...args),
  closeSeriesAtDate: (...args: unknown[]) => mockCloseSeriesAtDate(...args),
  softDeleteSeriesWithVersion: (...args: unknown[]) => mockSoftDeleteSeriesWithVersion(...args),
}));

vi.mock("@/server/repositories/calendar-event-exception-repository", () => ({
  reassignExceptionsFromDate: (...args: unknown[]) => mockReassignExceptionsFromDate(...args),
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
  createEventSeries,
  deleteEventSeries,
  splitEventSeries,
  updateEventSeries,
  type SeriesInput,
} from "./calendar-event-series-service";

function d(year: number, month: number, day: number) {
  return { year, month, day };
}

function fakeP2002() {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

function baseInput(overrides: Partial<SeriesInput> = {}): SeriesInput {
  return {
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 60,
    source: IncomeSource.DAILY,
    bannerFamily: null,
    note: null,
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
    ...overrides,
  };
}

function seriesRecord(overrides: Record<string, unknown> = {}) {
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
    rule: baseInput().rule,
    isActive: true,
    splitFromSeriesId: null,
    version: 1,
    ...overrides,
  };
}

describe("createEventSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
  });

  it("creates a valid series", async () => {
    mockCreateSeries.mockResolvedValue(seriesRecord());
    const result = await createEventSeries("user-1", baseInput(), "Europe/Berlin", "key-12345678");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.replay).toBe(false);
  });

  it("rejects an invalid recurrence rule (VALIDATION_ERROR)", async () => {
    const invalidInput = baseInput({ rule: { ...baseInput().rule, interval: 0 } });
    const result = await createEventSeries("user-1", invalidInput, "Europe/Berlin", "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("VALIDATION_ERROR");
    expect(mockCreateSeries).not.toHaveBeenCalled();
  });

  it("rejects PULL series templates (VALIDATION_ERROR)", async () => {
    // @ts-expect-error - intentionally invalid type for the test
    const invalidInput = baseInput({ type: TransactionType.PULL, source: null });
    const result = await createEventSeries("user-1", invalidInput, "Europe/Berlin", "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("VALIDATION_ERROR");
  });

  describe("idempotency", () => {
    it("same key, same normalized payload -> replays without writing again", async () => {
      const stored = { ok: true, record: seriesRecord(), replay: false };
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "match", response: stored });

      const result = await createEventSeries("user-1", baseInput(), "Europe/Berlin", "key-12345678");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
      expect(mockCreateSeries).not.toHaveBeenCalled();
    });

    it("same key, different payload -> IDEMPOTENCY_KEY_REUSED", async () => {
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "mismatch" });
      const result = await createEventSeries("user-1", baseInput(), "Europe/Berlin", "key-12345678");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
      expect(mockCreateSeries).not.toHaveBeenCalled();
    });

    it("concurrent identical requests -> loser replays winner's result", async () => {
      mockCreateSeries.mockResolvedValue(seriesRecord());
      const winner = { ok: true, record: seriesRecord(), replay: false };
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "match", response: winner });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await createEventSeries("user-1", baseInput(), "Europe/Berlin", "key-12345678");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
    });

    it("concurrent mismatched requests -> loser gets IDEMPOTENCY_KEY_REUSED", async () => {
      mockCreateSeries.mockResolvedValue(seriesRecord());
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "mismatch" });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await createEventSeries("user-1", baseInput(), "Europe/Berlin", "key-12345678");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
    });
  });

  describe("transaction rollback", () => {
    it("propagates an audit-log failure without recording idempotency", async () => {
      mockCreateSeries.mockResolvedValue(seriesRecord());
      mockCreateAuditLog.mockRejectedValue(new Error("audit log failed"));

      await expect(createEventSeries("user-1", baseInput(), "Europe/Berlin", "key-12345678")).rejects.toThrow(
        "audit log failed",
      );
      expect(mockCreateIdempotencyRecord).not.toHaveBeenCalled();
    });
  });
});

describe("updateEventSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
  });

  it("updates a series when the version matches", async () => {
    mockUpdateSeriesWithVersion.mockResolvedValue({ kind: "OK", record: seriesRecord({ version: 2 }) });
    const result = await updateEventSeries("user-1", "series-1", baseInput(), 1, "key-12345678");
    expect(result.ok).toBe(true);
  });

  it("returns NOT_FOUND when the series doesn't belong to this user (or doesn't exist)", async () => {
    mockUpdateSeriesWithVersion.mockResolvedValue({ kind: "NOT_FOUND" });
    const result = await updateEventSeries("user-1", "series-1", baseInput(), 1, "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("NOT_FOUND");
  });

  it("returns STALE_STATE on a version mismatch", async () => {
    mockUpdateSeriesWithVersion.mockResolvedValue({
      kind: "VERSION_CONFLICT",
      current: seriesRecord({ version: 5 }),
    });
    const result = await updateEventSeries("user-1", "series-1", baseInput(), 1, "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("STALE_STATE");
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it("ownership isolation: repository call is always scoped to userId (never trusts a cross-user id)", async () => {
    mockUpdateSeriesWithVersion.mockResolvedValue({ kind: "NOT_FOUND" });
    await updateEventSeries("attacker", "someone-elses-series", baseInput(), 1, "key-12345678");
    expect(mockUpdateSeriesWithVersion).toHaveBeenCalledWith(
      expect.anything(),
      "attacker",
      "someone-elses-series",
      expect.anything(),
      1,
    );
  });
});

describe("deleteEventSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
  });

  it("soft-deletes (isActive=false) without touching exceptions or transactions", async () => {
    mockSoftDeleteSeriesWithVersion.mockResolvedValue({
      kind: "OK",
      record: seriesRecord({ isActive: false, version: 2 }),
    });
    const result = await deleteEventSeries("user-1", "series-1", 1, "key-12345678");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record.isActive).toBe(false);
    expect(mockReassignExceptionsFromDate).not.toHaveBeenCalled();
  });

  it("returns STALE_STATE on version mismatch", async () => {
    mockSoftDeleteSeriesWithVersion.mockResolvedValue({
      kind: "VERSION_CONFLICT",
      current: seriesRecord({ version: 3 }),
    });
    const result = await deleteEventSeries("user-1", "series-1", 1, "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("STALE_STATE");
  });
});

describe("splitEventSeries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
    mockReassignExceptionsFromDate.mockResolvedValue({ reassignedCount: 0 });
  });

  it("splitting AT the first occurrence collapses to an in-place edit (no new series)", async () => {
    mockGetSeriesById.mockResolvedValue(seriesRecord({ version: 1 })); // startDate = 2026-01-01
    mockUpdateSeriesWithVersion.mockResolvedValue({ kind: "OK", record: seriesRecord({ version: 2 }) });

    const result = await splitEventSeries(
      "user-1",
      "series-1",
      d(2026, 1, 1), // == startDate
      baseInput({ amount: 999 }),
      1,
      "key-12345678",
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mode).toBe("IN_PLACE_EDIT");
    expect(mockCreateSeries).not.toHaveBeenCalled();
    expect(mockCloseSeriesAtDate).not.toHaveBeenCalled();
  });

  it("splitting in the middle closes the old series and creates a new one", async () => {
    mockGetSeriesById.mockResolvedValue(seriesRecord({ version: 1 }));
    mockCloseSeriesAtDate.mockResolvedValue({
      kind: "OK",
      record: seriesRecord({ version: 2, rule: { ...baseInput().rule, endType: RecurrenceEndType.UNTIL_DATE, endDate: d(2026, 1, 9) } }),
    });
    mockCreateSeries.mockResolvedValue(
      seriesRecord({ id: "series-2", splitFromSeriesId: "series-1", rule: { ...baseInput().rule, startDate: d(2026, 1, 10) } }),
    );

    const result = await splitEventSeries(
      "user-1",
      "series-1",
      d(2026, 1, 10), // the 10th occurrence of a DAILY series starting Jan 1
      baseInput({ amount: 999 }),
      1,
      "key-12345678",
    );

    expect(result.ok).toBe(true);
    if (result.ok && result.mode === "SPLIT") {
      expect(result.oldSeries.version).toBe(2);
      expect(result.newSeries.splitFromSeriesId).toBe("series-1");
    }
    expect(mockCloseSeriesAtDate).toHaveBeenCalledWith(expect.anything(), "user-1", "series-1", d(2026, 1, 9), 1);
  });

  it("reassigns future exceptions (>= split date) to the new series", async () => {
    mockGetSeriesById.mockResolvedValue(seriesRecord({ version: 1 }));
    mockCloseSeriesAtDate.mockResolvedValue({ kind: "OK", record: seriesRecord({ version: 2 }) });
    mockCreateSeries.mockResolvedValue(seriesRecord({ id: "series-2", splitFromSeriesId: "series-1" }));
    mockReassignExceptionsFromDate.mockResolvedValue({ reassignedCount: 3 });

    const result = await splitEventSeries(
      "user-1",
      "series-1",
      d(2026, 1, 10),
      baseInput(),
      1,
      "key-12345678",
    );

    expect(mockReassignExceptionsFromDate).toHaveBeenCalledWith(expect.anything(), "series-1", "series-2", d(2026, 1, 10));
    expect(result.ok).toBe(true);
    if (result.ok && result.mode === "SPLIT") expect(result.reassignedExceptionCount).toBe(3);
  });

  it("rejects a split date that is not an actual scheduled occurrence (INVALID_OCCURRENCE)", async () => {
    mockGetSeriesById.mockResolvedValue(
      seriesRecord({ rule: { ...baseInput().rule, frequency: RecurrenceFrequency.WEEKLY, daysOfWeek: [1], startDate: d(2026, 1, 5) } }),
    );
    // Jan 6 2026 is a Tuesday — not Monday, so not a scheduled occurrence.
    const result = await splitEventSeries("user-1", "series-1", d(2026, 1, 6), baseInput(), 1, "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("INVALID_OCCURRENCE");
    expect(mockCloseSeriesAtDate).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the series doesn't belong to this user", async () => {
    mockGetSeriesById.mockResolvedValue(null);
    const result = await splitEventSeries("attacker", "someone-elses-series", d(2026, 1, 10), baseInput(), 1, "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("NOT_FOUND");
  });

  it("returns STALE_STATE when closing the old series hits a version conflict", async () => {
    mockGetSeriesById.mockResolvedValue(seriesRecord({ version: 1 }));
    mockCloseSeriesAtDate.mockResolvedValue({ kind: "VERSION_CONFLICT", current: seriesRecord({ version: 4 }) });

    const result = await splitEventSeries("user-1", "series-1", d(2026, 1, 10), baseInput(), 1, "key-12345678");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("STALE_STATE");
    expect(mockCreateSeries).not.toHaveBeenCalled();
  });

  it("never touches CalendarTransaction rows (preservation of materialized history) — the service imports no transaction repository at all", async () => {
    // Structural guarantee: this test file mocks every repository the
    // service imports; there is no transaction-repository mock here
    // because calendar-event-series-service.ts has no import of it. If a
    // future edit added one without updating this test, any call would
    // throw ("no such export") rather than silently touching real data.
    mockGetSeriesById.mockResolvedValue(seriesRecord({ version: 1 }));
    mockCloseSeriesAtDate.mockResolvedValue({ kind: "OK", record: seriesRecord({ version: 2 }) });
    mockCreateSeries.mockResolvedValue(seriesRecord({ id: "series-2" }));

    const result = await splitEventSeries("user-1", "series-1", d(2026, 1, 10), baseInput(), 1, "key-12345678");
    expect(result.ok).toBe(true);
  });

  describe("idempotency & races", () => {
    it("same key, same payload -> replay", async () => {
      const stored = {
        ok: true,
        mode: "SPLIT" as const,
        oldSeries: seriesRecord({ version: 2 }),
        newSeries: seriesRecord({ id: "series-2" }),
        reassignedExceptionCount: 0,
        replay: false,
      };
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "match", response: stored });

      const result = await splitEventSeries("user-1", "series-1", d(2026, 1, 10), baseInput(), 1, "key-12345678");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
      expect(mockGetSeriesById).not.toHaveBeenCalled();
    });

    it("same key, different payload -> IDEMPOTENCY_KEY_REUSED", async () => {
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "mismatch" });
      const result = await splitEventSeries("user-1", "series-1", d(2026, 1, 10), baseInput(), 1, "key-12345678");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
    });

    it("concurrent identical split requests -> loser replays winner", async () => {
      mockGetSeriesById.mockResolvedValue(seriesRecord({ version: 1 }));
      mockCloseSeriesAtDate.mockResolvedValue({ kind: "OK", record: seriesRecord({ version: 2 }) });
      mockCreateSeries.mockResolvedValue(seriesRecord({ id: "series-2" }));
      const winner = {
        ok: true,
        mode: "SPLIT" as const,
        oldSeries: seriesRecord({ version: 2 }),
        newSeries: seriesRecord({ id: "series-2" }),
        reassignedExceptionCount: 0,
        replay: false,
      };
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "match", response: winner });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await splitEventSeries("user-1", "series-1", d(2026, 1, 10), baseInput(), 1, "key-12345678");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
    });
  });
});
