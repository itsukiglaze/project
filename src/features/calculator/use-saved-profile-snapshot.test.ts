// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { BannerFamily } from "@/config/gacha";
import { useSavedProfileSnapshot } from "./use-saved-profile-snapshot";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe("useSavedProfileSnapshot", () => {
  it("reports resources as available with the real saved values when version > 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/resources")) {
          return Promise.resolve(
            jsonResponse({
              polychrome: 1600,
              monochrome: 300,
              encryptedMasterTape: 3,
              masterTape: 0,
              boopon: 0,
              version: 2,
            }),
          );
        }
        return Promise.resolve(jsonResponse({ bannerStates: [] }));
      }),
    );

    const { result } = renderHook(() => useSavedProfileSnapshot(true));

    await waitFor(() => expect(result.current.resources.status).toBe("available"));
    if (result.current.resources.status === "available") {
      expect(result.current.resources.snapshot.polychrome).toBe(1600);
    }
  });

  it("reports resources as unavailable when version is 0 (no real row saved yet)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/resources")) {
          return Promise.resolve(
            jsonResponse({
              polychrome: 0,
              monochrome: 0,
              encryptedMasterTape: 0,
              masterTape: 0,
              boopon: 0,
              version: 0,
            }),
          );
        }
        return Promise.resolve(jsonResponse({ bannerStates: [] }));
      }),
    );

    const { result } = renderHook(() => useSavedProfileSnapshot(true));

    await waitFor(() => expect(result.current.resources.status).toBe("unavailable"));
  });

  it("reports resources as an error state when the fetch itself fails, never silently treating it as available/zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/resources")) return Promise.reject(new Error("network down"));
        return Promise.resolve(jsonResponse({ bannerStates: [] }));
      }),
    );

    const { result } = renderHook(() => useSavedProfileSnapshot(true));

    await waitFor(() => expect(result.current.resources.status).toBe("error"));
  });

  it("getPity returns available with the real saved pity for a family present in the response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/resources")) {
          return Promise.resolve(
            jsonResponse({ polychrome: 0, monochrome: 0, encryptedMasterTape: 0, masterTape: 0, boopon: 0, version: 0 }),
          );
        }
        return Promise.resolve(
          jsonResponse({
            bannerStates: [
              { family: BannerFamily.EXCLUSIVE_AGENT, sRankPity: 42, aRankPity: 3, guaranteeActive: false, version: 1 },
            ],
          }),
        );
      }),
    );

    const { result } = renderHook(() => useSavedProfileSnapshot(true));

    await waitFor(() => {
      const pity = result.current.getPity(BannerFamily.EXCLUSIVE_AGENT);
      expect(pity.status).toBe("available");
    });
    const pity = result.current.getPity(BannerFamily.EXCLUSIVE_AGENT);
    if (pity.status === "available") {
      expect(pity.snapshot.sRankPity).toBe(42);
    }
  });

  it("getPity returns unavailable for a family absent from the response (never-touched family, e.g. a first-time user)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/resources")) {
          return Promise.resolve(
            jsonResponse({ polychrome: 0, monochrome: 0, encryptedMasterTape: 0, masterTape: 0, boopon: 0, version: 0 }),
          );
        }
        return Promise.resolve(jsonResponse({ bannerStates: [] }));
      }),
    );

    const { result } = renderHook(() => useSavedProfileSnapshot(true));

    await waitFor(() => {
      const pity = result.current.getPity(BannerFamily.W_ENGINE);
      expect(pity.status).toBe("unavailable");
    });
  });

  it("getPity returns unavailable for a family with version 0 even if present in the response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/resources")) {
          return Promise.resolve(
            jsonResponse({ polychrome: 0, monochrome: 0, encryptedMasterTape: 0, masterTape: 0, boopon: 0, version: 0 }),
          );
        }
        return Promise.resolve(
          jsonResponse({
            bannerStates: [
              { family: BannerFamily.BANGBOO, sRankPity: 0, aRankPity: 0, guaranteeActive: false, version: 0 },
            ],
          }),
        );
      }),
    );

    const { result } = renderHook(() => useSavedProfileSnapshot(true));

    await waitFor(() => {
      const pity = result.current.getPity(BannerFamily.BANGBOO);
      expect(pity.status).toBe("unavailable");
    });
  });

  it("does not fetch at all while enabled=false — never races the session cookie before auth completes", () => {
    const fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ bannerStates: [] })));
    vi.stubGlobal("fetch", fetchSpy);

    const { result } = renderHook(() => useSavedProfileSnapshot(false));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.resources.status).toBe("loading");
    expect(result.current.getPity(BannerFamily.EXCLUSIVE_AGENT).status).toBe("loading");
  });

  it("starts fetching once enabled flips from false to true", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/resources")) {
        return Promise.resolve(
          jsonResponse({ polychrome: 500, monochrome: 0, encryptedMasterTape: 0, masterTape: 0, boopon: 0, version: 1 }),
        );
      }
      return Promise.resolve(jsonResponse({ bannerStates: [] }));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { result, rerender } = renderHook(({ enabled }) => useSavedProfileSnapshot(enabled), {
      initialProps: { enabled: false },
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.resources.status).toBe("available"));
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("starts both resources and pity in a loading state before the fetches resolve", () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => pending));

    const { result } = renderHook(() => useSavedProfileSnapshot(true));

    expect(result.current.resources.status).toBe("loading");
    expect(result.current.getPity(BannerFamily.EXCLUSIVE_AGENT).status).toBe("loading");
    resolveFetch(jsonResponse({ bannerStates: [] }));
  });
});
