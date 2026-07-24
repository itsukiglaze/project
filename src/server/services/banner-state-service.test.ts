import { beforeEach, describe, expect, it, vi } from "vitest";
import { BannerFamily } from "@/config/gacha";

const mockGetVersionedBannerState = vi.fn();
const mockUpsertBannerStateWithVersion = vi.fn();
const mockLookupIdempotencyRecord = vi.fn();
const mockCreateIdempotencyRecord = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}));

vi.mock("@/server/repositories/banner-state-repository", () => ({
  getVersionedBannerState: (...args: unknown[]) => mockGetVersionedBannerState(...args),
  upsertBannerStateWithVersion: (...args: unknown[]) => mockUpsertBannerStateWithVersion(...args),
}));

vi.mock("@/server/repositories/idempotency-repository", () => ({
  lookupIdempotencyRecord: (...args: unknown[]) => mockLookupIdempotencyRecord(...args),
  createIdempotencyRecord: (...args: unknown[]) => mockCreateIdempotencyRecord(...args),
  isIdempotencyConflict: (err: unknown) => (err as { code?: string })?.code === "P2002",
}));

vi.mock("@/server/repositories/audit-log-repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

import { saveBannerState } from "./banner-state-service";

type WriteValues = { sRankPity: number; aRankPity: number; guaranteeActive: boolean };

function fakeP2002() {
  const err = new Error("Unique constraint failed") as Error & { code: string };
  err.code = "P2002";
  return err;
}

describe("saveBannerState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockCreateIdempotencyRecord.mockResolvedValue(undefined);
    mockUpsertBannerStateWithVersion.mockImplementation(
      (_tx: unknown, _userId: string, family: BannerFamily, values: WriteValues, expectedVersion: number) =>
        Promise.resolve({ kind: "OK", state: { family, ...values }, version: expectedVersion + 1 }),
    );
  });

  it("rejects pity at or above hard pity for the family", async () => {
    mockGetVersionedBannerState.mockResolvedValue(null);

    const result = await saveBannerState(
      "user-1",
      BannerFamily.EXCLUSIVE_AGENT,
      { sRankPity: 90, aRankPity: 0, guaranteeActive: false },
      0,
      "a-valid-key-12345",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("VALIDATION_ERROR");
    expect(mockUpsertBannerStateWithVersion).not.toHaveBeenCalled();
  });

  it("accepts a valid pity value and reports the diff", async () => {
    mockGetVersionedBannerState.mockResolvedValue({
      family: BannerFamily.EXCLUSIVE_AGENT,
      sRankPity: 60,
      aRankPity: 2,
      guaranteeActive: false,
      version: 4,
    });

    const result = await saveBannerState(
      "user-1",
      BannerFamily.EXCLUSIVE_AGENT,
      { sRankPity: 70, aRankPity: 2, guaranteeActive: true },
      4,
      "a-valid-key-12345",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.changed.map((c) => c.field).sort()).toEqual(
        ["guaranteeActive", "sRankPity"].sort(),
      );
      expect(result.version).toBe(5);
    }
  });

  describe("guarantee normalization", () => {
    it("normalizes guaranteeActive to false for Bangboo regardless of what was sent", async () => {
      mockGetVersionedBannerState.mockResolvedValue(null);

      const result = await saveBannerState(
        "user-1",
        BannerFamily.BANGBOO,
        { sRankPity: 10, aRankPity: 0, guaranteeActive: true },
        0,
        "a-valid-key-12345",
      );

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.updated.guaranteeActive).toBe(false);
      const [, , , writtenValues] = mockUpsertBannerStateWithVersion.mock.calls[0];
      expect((writtenValues as WriteValues).guaranteeActive).toBe(false);
    });

    it("normalizes guaranteeActive to false for Stable regardless of what was sent", async () => {
      mockGetVersionedBannerState.mockResolvedValue(null);

      const result = await saveBannerState(
        "user-1",
        BannerFamily.STABLE,
        { sRankPity: 10, aRankPity: 0, guaranteeActive: true },
        0,
        "a-valid-key-12345",
      );

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.updated.guaranteeActive).toBe(false);
    });

    it("does NOT normalize guaranteeActive for Exclusive Agent / W-Engine — it's meaningful there", async () => {
      mockGetVersionedBannerState.mockResolvedValue(null);

      const result = await saveBannerState(
        "user-1",
        BannerFamily.EXCLUSIVE_AGENT,
        { sRankPity: 10, aRankPity: 0, guaranteeActive: true },
        0,
        "a-valid-key-12345",
      );

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.updated.guaranteeActive).toBe(true);
    });

    it("Bangboo requests differing ONLY in guaranteeActive normalize to the SAME idempotency hash (same key is safely reusable)", async () => {
      mockGetVersionedBannerState.mockResolvedValue(null);

      await saveBannerState(
        "user-1",
        BannerFamily.BANGBOO,
        { sRankPity: 10, aRankPity: 0, guaranteeActive: true },
        0,
        "shared-key-12345",
      );
      const [, , , , hashWithTrue] = mockCreateIdempotencyRecord.mock.calls[0];

      vi.clearAllMocks();
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
      mockCreateAuditLog.mockResolvedValue(undefined);
      mockCreateIdempotencyRecord.mockResolvedValue(undefined);
      mockUpsertBannerStateWithVersion.mockImplementation(
        (_tx: unknown, _userId: string, family: BannerFamily, values: WriteValues, expectedVersion: number) =>
          Promise.resolve({ kind: "OK", state: { family, ...values }, version: expectedVersion + 1 }),
      );
      mockGetVersionedBannerState.mockResolvedValue(null);

      await saveBannerState(
        "user-1",
        BannerFamily.BANGBOO,
        { sRankPity: 10, aRankPity: 0, guaranteeActive: false }, // only this differs
        0,
        "shared-key-12345",
      );
      const [, , , , hashWithFalse] = mockCreateIdempotencyRecord.mock.calls[0];

      expect(hashWithTrue).toBe(hashWithFalse);
    });

    it("Stable requests differing ONLY in guaranteeActive normalize to the SAME idempotency hash", async () => {
      mockGetVersionedBannerState.mockResolvedValue(null);

      await saveBannerState(
        "user-1",
        BannerFamily.STABLE,
        { sRankPity: 10, aRankPity: 0, guaranteeActive: true },
        0,
        "shared-key-abcde",
      );
      const [, , , , hashWithTrue] = mockCreateIdempotencyRecord.mock.calls[0];

      vi.clearAllMocks();
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "missing" });
      mockCreateAuditLog.mockResolvedValue(undefined);
      mockCreateIdempotencyRecord.mockResolvedValue(undefined);
      mockUpsertBannerStateWithVersion.mockImplementation(
        (_tx: unknown, _userId: string, family: BannerFamily, values: WriteValues, expectedVersion: number) =>
          Promise.resolve({ kind: "OK", state: { family, ...values }, version: expectedVersion + 1 }),
      );
      mockGetVersionedBannerState.mockResolvedValue(null);

      await saveBannerState(
        "user-1",
        BannerFamily.STABLE,
        { sRankPity: 10, aRankPity: 0, guaranteeActive: false },
        0,
        "shared-key-abcde",
      );
      const [, , , , hashWithFalse] = mockCreateIdempotencyRecord.mock.calls[0];

      expect(hashWithTrue).toBe(hashWithFalse);
    });
  });

  describe("request-bound idempotency replay", () => {
    it("same key, same normalized payload -> replays without re-validating or re-writing", async () => {
      const stored = {
        ok: true as const,
        previous: { sRankPity: 0, aRankPity: 0, guaranteeActive: false },
        updated: { sRankPity: 70, aRankPity: 0, guaranteeActive: true },
        changed: [{ field: "sRankPity" as const, previous: 0, next: 70 }],
        version: 2,
        replay: false,
      };
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "match", response: stored });

      const result = await saveBannerState(
        "user-1",
        BannerFamily.EXCLUSIVE_AGENT,
        // Even a deliberately invalid value should not matter — the replay
        // short-circuits before validation.
        { sRankPity: 999, aRankPity: 0, guaranteeActive: false },
        0,
        "retry-key-12345",
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.replay).toBe(true);
        expect(result.updated.sRankPity).toBe(70);
      }
      expect(mockUpsertBannerStateWithVersion).not.toHaveBeenCalled();
    });

    it("same key, DIFFERENT payload -> IDEMPOTENCY_KEY_REUSED", async () => {
      mockLookupIdempotencyRecord.mockResolvedValue({ status: "mismatch" });

      const result = await saveBannerState(
        "user-1",
        BannerFamily.EXCLUSIVE_AGENT,
        { sRankPity: 70, aRankPity: 0, guaranteeActive: true },
        0,
        "reused-key-12345",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
      expect(mockUpsertBannerStateWithVersion).not.toHaveBeenCalled();
    });
  });

  describe("stale-state conflict", () => {
    it("returns STALE_STATE instead of writing when the version has moved on", async () => {
      mockGetVersionedBannerState.mockResolvedValue({
        family: BannerFamily.EXCLUSIVE_AGENT,
        sRankPity: 60,
        aRankPity: 0,
        guaranteeActive: false,
        version: 3,
      });
      mockUpsertBannerStateWithVersion.mockResolvedValue({
        kind: "VERSION_CONFLICT",
        current: { family: BannerFamily.EXCLUSIVE_AGENT, sRankPity: 65, aRankPity: 0, guaranteeActive: false },
        version: 4,
      });

      const result = await saveBannerState(
        "user-1",
        BannerFamily.EXCLUSIVE_AGENT,
        { sRankPity: 70, aRankPity: 0, guaranteeActive: true },
        3,
        "a-valid-key-12345",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("STALE_STATE");
      expect(mockCreateAuditLog).not.toHaveBeenCalled();
    });
  });

  describe("concurrent duplicate request (race condition)", () => {
    it("same key/same payload racing -> the loser replays the winner's result", async () => {
      mockGetVersionedBannerState.mockResolvedValue(null);
      const winner = {
        ok: true,
        previous: { sRankPity: 0, aRankPity: 0, guaranteeActive: false },
        updated: { sRankPity: 70, aRankPity: 0, guaranteeActive: true },
        changed: [],
        version: 1,
        replay: false,
      };
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "match", response: winner });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await saveBannerState(
        "user-1",
        BannerFamily.EXCLUSIVE_AGENT,
        { sRankPity: 70, aRankPity: 0, guaranteeActive: true },
        0,
        "a-valid-key-12345",
      );

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.replay).toBe(true);
    });

    it("same key/DIFFERENT payload racing -> the loser gets IDEMPOTENCY_KEY_REUSED", async () => {
      mockGetVersionedBannerState.mockResolvedValue(null);
      mockLookupIdempotencyRecord
        .mockResolvedValueOnce({ status: "missing" })
        .mockResolvedValueOnce({ status: "mismatch" });
      mockCreateIdempotencyRecord.mockRejectedValue(fakeP2002());

      const result = await saveBannerState(
        "user-1",
        BannerFamily.EXCLUSIVE_AGENT,
        { sRankPity: 70, aRankPity: 0, guaranteeActive: true },
        0,
        "a-valid-key-12345",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("IDEMPOTENCY_KEY_REUSED");
    });
  });
});
