import { afterEach, describe, expect, it, vi } from "vitest";
import { BannerFamily } from "@/config/gacha";
import {
  fetchAllBannerStates,
  fetchResourceSnapshot,
  saveBannerStateSnapshot,
  saveResourceSnapshot,
} from "./api";

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body }),
  );
}

const SNAPSHOT = { polychrome: 320, monochrome: 0, encryptedMasterTape: 2, masterTape: 0, boopon: 0 };
const VERSIONED_SNAPSHOT = { ...SNAPSHOT, version: 3 };

describe("profile api client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchResourceSnapshot recognizes a valid versioned snapshot", async () => {
    mockFetchOnce(200, VERSIONED_SNAPSHOT);
    const result = await fetchResourceSnapshot();
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.data.version).toBe(3);
  });

  it("saveResourceSnapshot sends expectedVersion and idempotencyKey, and reports the diff", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        previous: { ...SNAPSHOT, polychrome: 0 },
        updated: SNAPSHOT,
        changed: [{ field: "polychrome", previous: 0, next: 320 }],
        version: 4,
        replay: false,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await saveResourceSnapshot(SNAPSHOT, 3, "a-valid-key-12345");

    expect(result.status).toBe("success");
    const [, init] = fetchSpy.mock.calls[0];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.idempotencyKey).toBe("a-valid-key-12345");
    expect(sentBody.expectedVersion).toBe(3);
  });

  it("maps HTTP 400 to validation_error", async () => {
    mockFetchOnce(400, { error: { code: "VALIDATION_ERROR", message: "bad", fieldErrors: {} } });
    const result = await saveResourceSnapshot(SNAPSHOT, 3, "a-valid-key-12345");
    expect(result.status).toBe("validation_error");
  });

  it("maps HTTP 401 to auth_error", async () => {
    mockFetchOnce(401, { error: { code: "NOT_AUTHENTICATED", message: "login" } });
    const result = await fetchResourceSnapshot();
    expect(result.status).toBe("auth_error");
  });

  it("maps HTTP 409 STALE_STATE to a typed conflict", async () => {
    mockFetchOnce(409, {
      error: { code: "STALE_STATE", message: "stale" },
      current: { ...SNAPSHOT, polychrome: 999 },
      currentVersion: 5,
    });
    const result = await saveResourceSnapshot(SNAPSHOT, 3, "a-valid-key-12345");
    expect(result.status).toBe("conflict");
    if (result.status === "conflict") expect(result.currentVersion).toBe(5);
  });

  it("maps a thrown fetch error to network_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
    const result = await fetchResourceSnapshot();
    expect(result.status).toBe("network_error");
  });

  it("fetchAllBannerStates recognizes a valid versioned list", async () => {
    mockFetchOnce(200, {
      bannerStates: [
        { family: BannerFamily.EXCLUSIVE_AGENT, sRankPity: 0, aRankPity: 0, guaranteeActive: false, version: 1 },
      ],
    });
    const result = await fetchAllBannerStates();
    expect(result.status).toBe("success");
  });

  it("saveBannerStateSnapshot posts to the family-specific URL with version and key", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        previous: { sRankPity: 60, aRankPity: 0, guaranteeActive: false },
        updated: { sRankPity: 70, aRankPity: 0, guaranteeActive: true },
        changed: [],
        version: 2,
        replay: false,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await saveBannerStateSnapshot(
      BannerFamily.EXCLUSIVE_AGENT,
      { sRankPity: 70, aRankPity: 0, guaranteeActive: true },
      1,
      "a-valid-key-12345",
    );

    expect(fetchSpy.mock.calls[0][0]).toBe("/api/banner-states/EXCLUSIVE_AGENT");
    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(sentBody.expectedVersion).toBe(1);
  });

  it("does not treat an unrecognized 200 body as success", async () => {
    mockFetchOnce(200, { unexpected: true });
    const result = await fetchResourceSnapshot();
    expect(result.status).toBe("unknown_error");
  });
});
