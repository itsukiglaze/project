import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencyType } from "@/lib/calendar-math";
import { computeRequestHash } from "@/lib/idempotency-hash";

const mockGetLatestSnapshot = vi.fn();
const mockGetLatestSnapshotBefore = vi.fn();
const mockGetSnapshotByLocalDate = vi.fn();
const mockListSnapshotsUpTo = vi.fn();
const mockUpsertSnapshotWithVersion = vi.fn();
const mockDeleteSnapshotWithVersion = vi.fn();
const mockSyncResourceBalanceFromLatestSnapshot = vi.fn();
const mockLookupIdempotencyRecord = vi.fn();
const mockCreateIdempotencyRecord = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}));

vi.mock("@/server/repositories/resource-snapshot-repository", () => ({
  getLatestSnapshot: (...args: unknown[]) => mockGetLatestSnapshot(...args),
  getLatestSnapshotBefore: (...args: unknown[]) => mockGetLatestSnapshotBefore(...args),
  getSnapshotByLocalDate: (...args: unknown[]) => mockGetSnapshotByLocalDate(...args),
  listSnapshotsUpTo: (...args: unknown[]) => mockListSnapshotsUpTo(...args),
  upsertSnapshotWithVersion: (...args: unknown[]) => mockUpsertSnapshotWithVersion(...args),
  deleteSnapshotWithVersion: (...args: unknown[]) => mockDeleteSnapshotWithVersion(...args),
  syncResourceBalanceFromLatestSnapshot: (...args: unknown[]) => mockSyncResourceBalanceFromLatestSnapshot(...args),
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
  deleteResourceSnapshot,
  getLatestResourceSnapshot,
  listResourceSnapshotHistory,
  saveResourceSnapshot,
} from "./resource-snapshot-service";

const DATE_25 = { year: 2026, month: 7, day: 25 };
const DATE_24 = { year: 2026, month: 7, day: 24 };
const DATE_20 = { year: 2026, month: 7, day: 20 };

function snapshotRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "snap-1",
    userId: "user-1",
    localDate: DATE_25,
    capturedAt: new Date("2026-07-25T10:00:00.000Z"),
    timezone: "UTC",
    note: null,
    items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }],
    version: 1,
    createdAt: new Date("2026-07-25T10:00:00.000Z"),
    updatedAt: new Date("2026-07-25T10:00:00.000Z"),
    ...overrides,
  };
}

function fakeP2002() {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

const VALID_INPUT = {
  localDate: DATE_25,
  timezone: "UTC",
  note: null,
  items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }],
};

describe("saveResourceSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
    mockSyncResourceBalanceFromLatestSnapshot.mockResolvedValue(undefined);
  });

  it("rejects a negative amount before touching the repository", async () => {
    const result = await saveResourceSnapshot(
      "user-1",
      { ...VALID_INPUT, items: [{ currencyType: CurrencyType.POLYCHROME, amount: -1 }] },
      0,
      "a-valid-key-12345",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("VALIDATION_ERROR");
    expect(mockUpsertSnapshotWithVersion).not.toHaveBeenCalled();
  });

  it("rejects a duplicate currencyType in items", async () => {
    const result = await saveResourceSnapshot(
      "user-1",
      {
        ...VALID_INPUT,
        items: [
          { currencyType: CurrencyType.POLYCHROME, amount: 100 },
          { currencyType: CurrencyType.POLYCHROME, amount: 200 },
        ],
      },
      0,
      "a-valid-key-12345",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("VALIDATION_ERROR");
  });

  it("looks up the latest snapshot strictly before this date (not the global latest) to build the comparison", async () => {
    mockGetLatestSnapshotBefore.mockResolvedValue(
      snapshotRecord({ localDate: DATE_24, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }] }),
    );
    mockUpsertSnapshotWithVersion.mockResolvedValue({ kind: "OK", record: snapshotRecord() });

    const result = await saveResourceSnapshot("user-1", VALID_INPUT, 0, "a-valid-key-12345");

    expect(mockGetLatestSnapshotBefore).toHaveBeenCalledWith("user-1", DATE_25);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.comparison).toEqual([
        { currencyType: CurrencyType.POLYCHROME, current: 5420, previous: 5000, delta: 420, status: "positive" },
      ]);
      expect(result.snapshot.previousLocalDate).toEqual(DATE_24);
    }
  });

  it("reports no_previous_snapshot when this is the very first snapshot", async () => {
    mockGetLatestSnapshotBefore.mockResolvedValue(null);
    mockUpsertSnapshotWithVersion.mockResolvedValue({ kind: "OK", record: snapshotRecord() });

    const result = await saveResourceSnapshot("user-1", VALID_INPUT, 0, "a-valid-key-12345");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.comparison[0].status).toBe("no_previous_snapshot");
      expect(result.snapshot.previousLocalDate).toBeNull();
    }
  });

  it("atomically syncs ResourceBalance after a successful upsert, inside the same transaction", async () => {
    mockGetLatestSnapshotBefore.mockResolvedValue(null);
    mockUpsertSnapshotWithVersion.mockResolvedValue({ kind: "OK", record: snapshotRecord() });

    await saveResourceSnapshot("user-1", VALID_INPUT, 0, "a-valid-key-12345");

    expect(mockSyncResourceBalanceFromLatestSnapshot).toHaveBeenCalledTimes(1);
    expect(mockSyncResourceBalanceFromLatestSnapshot).toHaveBeenCalledWith({}, "user-1");
  });

  it("does NOT sync ResourceBalance when the upsert hits a version conflict", async () => {
    mockGetLatestSnapshotBefore.mockResolvedValue(null);
    mockUpsertSnapshotWithVersion.mockResolvedValue({ kind: "VERSION_CONFLICT", current: snapshotRecord({ version: 2 }) });

    const result = await saveResourceSnapshot("user-1", VALID_INPUT, 1, "a-valid-key-12345");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("STALE_STATE");
    expect(mockSyncResourceBalanceFromLatestSnapshot).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
    expect(mockCreateIdempotencyRecord).not.toHaveBeenCalled();
  });

  it("passes the exact localDate/timezone/note/items through to the repository upsert (same-date replace)", async () => {
    mockGetLatestSnapshotBefore.mockResolvedValue(null);
    mockUpsertSnapshotWithVersion.mockResolvedValue({ kind: "OK", record: snapshotRecord() });

    await saveResourceSnapshot("user-1", { ...VALID_INPUT, note: "morning check" }, 0, "a-valid-key-12345");

    expect(mockUpsertSnapshotWithVersion).toHaveBeenCalledWith(
      {},
      "user-1",
      DATE_25,
      "UTC",
      "morning check",
      VALID_INPUT.items,
      0,
    );
  });

  describe("request-bound idempotency replay", () => {
    it("same key, same normalized payload -> replays without writing again", async () => {
      const previousResponse = {
        ok: true,
        snapshot: { record: snapshotRecord(), comparison: [], previousLocalDate: null },
        replay: false,
      };
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "match", response: previousResponse });

      const result = await saveResourceSnapshot("user-1", VALID_INPUT, 0, "a-valid-key-12345");

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
      expect(mockUpsertSnapshotWithVersion).not.toHaveBeenCalled();
    });

    it("same key, different payload -> IDEMPOTENCY_KEY_REUSED", async () => {
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "mismatch" });

      const result = await saveResourceSnapshot("user-1", VALID_INPUT, 0, "a-valid-key-12345");

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
      expect(mockUpsertSnapshotWithVersion).not.toHaveBeenCalled();
    });

    it("stores a request hash bound to the exact input + expectedVersion", async () => {
      mockGetLatestSnapshotBefore.mockResolvedValue(null);
      mockUpsertSnapshotWithVersion.mockResolvedValue({ kind: "OK", record: snapshotRecord() });

      await saveResourceSnapshot("user-1", VALID_INPUT, 0, "a-valid-key-12345");

      expect(mockCreateIdempotencyRecord).toHaveBeenCalledTimes(1);
      const [, , , , requestHash] = mockCreateIdempotencyRecord.mock.calls[0];
      expect(requestHash).toBe(computeRequestHash({ input: VALID_INPUT, expectedVersion: 0 }));
    });
  });

  describe("concurrent duplicate request (race condition)", () => {
    it("same key/same payload racing -> the loser replays the winner's result", async () => {
      mockGetLatestSnapshotBefore.mockResolvedValue(null);
      mockUpsertSnapshotWithVersion.mockResolvedValue({ kind: "OK", record: snapshotRecord() });
      const winnerResponse = { ok: true, snapshot: { record: snapshotRecord(), comparison: [], previousLocalDate: null }, replay: false };
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "match", response: winnerResponse });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await saveResourceSnapshot("user-1", VALID_INPUT, 0, "a-valid-key-12345");

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
    });
  });
});

describe("getLatestResourceSnapshot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the user has never saved a snapshot", async () => {
    mockGetLatestSnapshot.mockResolvedValue(null);
    const result = await getLatestResourceSnapshot("user-1");
    expect(result).toBeNull();
    expect(mockGetLatestSnapshotBefore).not.toHaveBeenCalled();
  });

  it("compares the latest snapshot against the one immediately before it", async () => {
    mockGetLatestSnapshot.mockResolvedValue(snapshotRecord());
    mockGetLatestSnapshotBefore.mockResolvedValue(
      snapshotRecord({ localDate: DATE_24, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }] }),
    );

    const result = await getLatestResourceSnapshot("user-1");

    expect(mockGetLatestSnapshotBefore).toHaveBeenCalledWith("user-1", DATE_25);
    expect(result?.comparison[0]).toMatchObject({ delta: 420, status: "positive" });
  });
});

describe("listResourceSnapshotHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("compares each entry against its own immediate predecessor, not the global latest (non-consecutive dates)", async () => {
    mockListSnapshotsUpTo.mockResolvedValue([
      snapshotRecord({ localDate: DATE_20, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 4000 }] }),
      snapshotRecord({ localDate: DATE_24, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }] }),
      snapshotRecord({ localDate: DATE_25, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }] }),
    ]);

    const history = await listResourceSnapshotHistory("user-1", DATE_20, DATE_25);

    expect(mockListSnapshotsUpTo).toHaveBeenCalledWith("user-1", DATE_25);
    expect(history).toHaveLength(3);
    expect(history[0].comparison[0].status).toBe("no_previous_snapshot");
    expect(history[1].comparison[0]).toMatchObject({ previous: 4000, delta: 1000, status: "positive" });
    expect(history[2].comparison[0]).toMatchObject({ previous: 5000, delta: 420, status: "positive" });
  });

  it("still gives the earliest in-range entry a correct comparison against a snapshot dated before `from`", async () => {
    mockListSnapshotsUpTo.mockResolvedValue([
      snapshotRecord({ localDate: DATE_20, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 4000 }] }),
      snapshotRecord({ localDate: DATE_24, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }] }),
    ]);

    // Range starts at DATE_24 — DATE_20 is fetched only to serve as DATE_24's predecessor, then excluded from the result.
    const history = await listResourceSnapshotHistory("user-1", DATE_24, DATE_24);

    expect(history).toHaveLength(1);
    expect(history[0].record.localDate).toEqual(DATE_24);
    expect(history[0].comparison[0]).toMatchObject({ previous: 4000, delta: 1000, status: "positive" });
  });

  it("editing an old snapshot's value is reflected in the next snapshot's comparison on the very next call — nothing is cached", async () => {
    // Before the edit: DATE_24 was 5000, so DATE_25 (5420) shows +420.
    mockListSnapshotsUpTo.mockResolvedValueOnce([
      snapshotRecord({ localDate: DATE_24, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }] }),
      snapshotRecord({ localDate: DATE_25, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }] }),
    ]);
    const before = await listResourceSnapshotHistory("user-1", DATE_24, DATE_25);
    expect(before[1].comparison[0]).toMatchObject({ previous: 5000, delta: 420, status: "positive" });

    // After editing DATE_24 down to 5300 — no code path recomputes DATE_25's
    // stored delta; the next read simply reflects the new stored value.
    mockListSnapshotsUpTo.mockResolvedValueOnce([
      snapshotRecord({ localDate: DATE_24, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5300 }] }),
      snapshotRecord({ localDate: DATE_25, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }] }),
    ]);
    const after = await listResourceSnapshotHistory("user-1", DATE_24, DATE_25);
    expect(after[1].comparison[0]).toMatchObject({ previous: 5300, delta: 120, status: "positive" });
  });

  it("deleting the middle snapshot correctly re-pairs the two remaining neighbors on the next call", async () => {
    // Before delete: 20 -> 24 -> 25, each compared to its immediate predecessor.
    mockListSnapshotsUpTo.mockResolvedValueOnce([
      snapshotRecord({ localDate: DATE_20, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 4000 }] }),
      snapshotRecord({ localDate: DATE_24, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }] }),
      snapshotRecord({ localDate: DATE_25, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }] }),
    ]);
    const before = await listResourceSnapshotHistory("user-1", DATE_20, DATE_25);
    expect(before[2].comparison[0]).toMatchObject({ previous: 5000, delta: 420 });

    // After deleting DATE_24 — DATE_25 now correctly pairs against DATE_20.
    mockListSnapshotsUpTo.mockResolvedValueOnce([
      snapshotRecord({ localDate: DATE_20, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 4000 }] }),
      snapshotRecord({ localDate: DATE_25, items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }] }),
    ]);
    const after = await listResourceSnapshotHistory("user-1", DATE_20, DATE_25);
    expect(after).toHaveLength(2);
    expect(after[1].comparison[0]).toMatchObject({ previous: 4000, delta: 1420 });
  });
});

describe("deleteResourceSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
    mockSyncResourceBalanceFromLatestSnapshot.mockResolvedValue(undefined);
  });

  it("returns NOT_FOUND when no snapshot exists for that date", async () => {
    mockDeleteSnapshotWithVersion.mockResolvedValue({ kind: "NOT_FOUND" });
    const result = await deleteResourceSnapshot("user-1", DATE_25, 1, "a-valid-key-12345");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("NOT_FOUND");
  });

  it("re-syncs ResourceBalance after a successful delete (recalculates to whichever snapshot is now latest)", async () => {
    mockDeleteSnapshotWithVersion.mockResolvedValue({ kind: "OK", record: snapshotRecord() });
    await deleteResourceSnapshot("user-1", DATE_25, 1, "a-valid-key-12345");
    expect(mockSyncResourceBalanceFromLatestSnapshot).toHaveBeenCalledWith({}, "user-1");
  });

  it("returns a typed STALE_STATE conflict and does not sync the balance", async () => {
    mockDeleteSnapshotWithVersion.mockResolvedValue({ kind: "VERSION_CONFLICT", current: snapshotRecord({ version: 2 }) });
    const result = await deleteResourceSnapshot("user-1", DATE_25, 1, "a-valid-key-12345");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("STALE_STATE");
    expect(mockSyncResourceBalanceFromLatestSnapshot).not.toHaveBeenCalled();
  });
});
