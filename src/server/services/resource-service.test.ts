import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeRequestHash } from "@/lib/idempotency-hash";

const mockGetVersionedResourceBalance = vi.fn();
const mockUpsertResourceBalanceWithVersion = vi.fn();
const mockLookupIdempotencyRecord = vi.fn();
const mockCreateIdempotencyRecord = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}));

vi.mock("@/server/repositories/resource-balance-repository", () => ({
  getVersionedResourceBalance: (...args: unknown[]) => mockGetVersionedResourceBalance(...args),
  upsertResourceBalanceWithVersion: (...args: unknown[]) => mockUpsertResourceBalanceWithVersion(...args),
}));

vi.mock("@/server/repositories/idempotency-repository", () => ({
  lookupIdempotencyRecord: (...args: unknown[]) => mockLookupIdempotencyRecord(...args),
  createIdempotencyRecord: (...args: unknown[]) => mockCreateIdempotencyRecord(...args),
  isIdempotencyConflict: (err: unknown) => (err as { code?: string })?.code === "P2002",
}));

vi.mock("@/server/repositories/audit-log-repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

import { saveResources } from "./resource-service";

const PREVIOUS = { polychrome: 160, monochrome: 0, encryptedMasterTape: 1, masterTape: 0, boopon: 0 };
const NEXT_SNAPSHOT = {
  polychrome: 320,
  monochrome: 0,
  encryptedMasterTape: 2,
  masterTape: 0,
  boopon: 0,
};

function fakeP2002() {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

describe("saveResources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
    mockUpsertResourceBalanceWithVersion.mockImplementation(
      (_tx: unknown, _userId: string, values: typeof NEXT_SNAPSHOT, expectedVersion: number) =>
        Promise.resolve({ kind: "OK", snapshot: values, version: expectedVersion + 1 }),
    );
  });

  it("computes the diff against the previously stored snapshot", async () => {
    mockGetVersionedResourceBalance.mockResolvedValue({ ...PREVIOUS, version: 3 });

    const result = await saveResources("user-1", NEXT_SNAPSHOT, 3, "a-valid-key-12345");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.changed.map((c) => c.field).sort()).toEqual(
        ["encryptedMasterTape", "polychrome"].sort(),
      );
      expect(result.replay).toBe(false);
      expect(result.version).toBe(4);
    }
  });

  it("treats a first-time save (version 0) as a diff against the zeroed default", async () => {
    mockGetVersionedResourceBalance.mockResolvedValue(null);

    const result = await saveResources("user-1", NEXT_SNAPSHOT, 0, "a-valid-key-12345");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.previous).toEqual({
        polychrome: 0,
        monochrome: 0,
        encryptedMasterTape: 0,
        masterTape: 0,
        boopon: 0,
      });
    }
  });

  it("writes an audit log entry only when something actually changed", async () => {
    mockGetVersionedResourceBalance.mockResolvedValue({ ...NEXT_SNAPSHOT, version: 5 }); // identical -> no diff

    await saveResources("user-1", NEXT_SNAPSHOT, 5, "a-valid-key-12345");

    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it("stores an idempotency record (with its request hash) on every non-replay write", async () => {
    mockGetVersionedResourceBalance.mockResolvedValue(null);

    await saveResources("user-1", NEXT_SNAPSHOT, 0, "a-valid-key-12345");

    expect(mockCreateIdempotencyRecord).toHaveBeenCalledTimes(1);
    const [, , , , requestHash] = mockCreateIdempotencyRecord.mock.calls[0];
    expect(requestHash).toBe(computeRequestHash({ ...NEXT_SNAPSHOT, expectedVersion: 0 }));
  });

  describe("request-bound idempotency replay", () => {
    it("same key, same normalized payload -> replays without writing again", async () => {
      const previousResponse = {
        ok: true,
        previous: { polychrome: 0, monochrome: 0, encryptedMasterTape: 0, masterTape: 0, boopon: 0 },
        updated: NEXT_SNAPSHOT,
        changed: [{ field: "polychrome", previous: 0, next: 320 }],
        version: 1,
        replay: false,
      };
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "match", response: previousResponse });

      const result = await saveResources("user-1", NEXT_SNAPSHOT, 0, "a-valid-key-12345");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.replay).toBe(true);
        expect(result.updated).toEqual(NEXT_SNAPSHOT);
      }
      expect(mockUpsertResourceBalanceWithVersion).not.toHaveBeenCalled();
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    });

    it("same key, DIFFERENT payload -> IDEMPOTENCY_KEY_REUSED, never replays the old result", async () => {
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "mismatch" });

      const differentPayload = { ...NEXT_SNAPSHOT, polychrome: 999999 };
      const result = await saveResources("user-1", differentPayload, 0, "a-valid-key-12345");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
      }
      expect(mockUpsertResourceBalanceWithVersion).not.toHaveBeenCalled();
      expect(mockGetVersionedResourceBalance).not.toHaveBeenCalled();
    });

    it("an expired record is treated as missing by the repository, so the service proceeds normally", async () => {
      // The repository itself returns "missing" for expired rows — the
      // service has no separate expiry logic to duplicate/get wrong.
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
      mockGetVersionedResourceBalance.mockResolvedValue(null);

      const result = await saveResources("user-1", NEXT_SNAPSHOT, 0, "a-valid-key-12345");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(false);
    });
  });

  describe("concurrent duplicate request (race condition)", () => {
    it("same key/same payload racing -> the loser replays the winner's result", async () => {
      mockGetVersionedResourceBalance.mockResolvedValue(null);
      const winnerResponse = {
        ok: true,
        previous: { polychrome: 0, monochrome: 0, encryptedMasterTape: 0, masterTape: 0, boopon: 0 },
        updated: NEXT_SNAPSHOT,
        changed: [],
        version: 1,
        replay: false,
      };
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "match", response: winnerResponse });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await saveResources("user-1", NEXT_SNAPSHOT, 0, "a-valid-key-12345");

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
    });

    it("same key/DIFFERENT payload racing -> the loser gets IDEMPOTENCY_KEY_REUSED, not the winner's data", async () => {
      mockGetVersionedResourceBalance.mockResolvedValue(null);
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        // The winner committed a DIFFERENT payload under this key, so the
        // post-race re-check sees a hash mismatch.
        .mockResolvedValueOnce({ status: "mismatch" });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await saveResources("user-1", NEXT_SNAPSHOT, 0, "a-valid-key-12345");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
      }
    });

    it("still throws if the unique-constraint error can't be resolved at all", async () => {
      mockGetVersionedResourceBalance.mockResolvedValue(null);
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "missing" });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      await expect(saveResources("user-1", NEXT_SNAPSHOT, 0, "a-valid-key-12345")).rejects.toThrow();
    });
  });

  describe("transaction rollback", () => {
    it("propagates an error from the audit log write without recording an idempotency entry", async () => {
      mockGetVersionedResourceBalance.mockResolvedValue({ ...PREVIOUS, version: 1 });
      mockCreateAuditLog.mockRejectedValue(new Error("audit log write failed"));

      await expect(saveResources("user-1", NEXT_SNAPSHOT, 1, "a-valid-key-12345")).rejects.toThrow(
        "audit log write failed",
      );

      expect(mockCreateIdempotencyRecord).not.toHaveBeenCalled();
    });
  });

  describe("stale-state conflict", () => {
    it("returns a typed STALE_STATE conflict instead of overwriting when the version has moved on", async () => {
      mockGetVersionedResourceBalance.mockResolvedValue({ ...PREVIOUS, version: 3 });
      mockUpsertResourceBalanceWithVersion.mockResolvedValue({
        kind: "VERSION_CONFLICT",
        current: { ...PREVIOUS, polychrome: 999 },
        version: 4,
      });

      const result = await saveResources("user-1", NEXT_SNAPSHOT, 3, "a-valid-key-12345");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.kind).toBe("STALE_STATE");
      }
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
      expect(mockCreateIdempotencyRecord).not.toHaveBeenCalled();
    });
  });

  describe("audit log content", () => {
    it("audit log metadata never contains session tokens, initData, or other secret-shaped keys", async () => {
      mockGetVersionedResourceBalance.mockResolvedValue({ ...PREVIOUS, version: 1 });

      await saveResources("user-1", NEXT_SNAPSHOT, 1, "a-valid-key-12345");

      expect(mockCreateAuditLog).toHaveBeenCalledTimes(1);
      const [, , , metadata] = mockCreateAuditLog.mock.calls[0];
      const serialized = JSON.stringify(metadata).toLowerCase();
      expect(serialized).not.toMatch(/token|initdata|password|secret/);
    });
  });
});
