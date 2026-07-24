import { describe, expect, it } from "vitest";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { buildCalculatorRequestPayload, getClientFieldErrors } from "./build-request";
import { createDefaultFamilyFormState } from "./types";

describe("getClientFieldErrors", () => {
  it("6. flags a negative pity value", () => {
    const config = getBannerConfig(BannerFamily.EXCLUSIVE_AGENT);
    const state = {
      ...createDefaultFamilyFormState(),
      useSavedBannerState: false,
      bannerState: { sRankPity: "-5", aRankPity: "0", guaranteeActive: false },
    };
    const errors = getClientFieldErrors(BannerFamily.EXCLUSIVE_AGENT, state, config);
    expect(errors.sRankPity).toBeDefined();
  });

  it("7. flags a fractional cassette count", () => {
    const config = getBannerConfig(BannerFamily.EXCLUSIVE_AGENT);
    const state = {
      ...createDefaultFamilyFormState(),
      useSavedResources: false,
      resources: {
        polychrome: "0",
        monochrome: "0",
        encryptedMasterTape: "1.5",
        masterTape: "0",
        boopon: "0",
        includeMonochrome: false,
      },
    };
    const errors = getClientFieldErrors(BannerFamily.EXCLUSIVE_AGENT, state, config);
    expect(errors.encryptedMasterTape).toBeDefined();
  });
});

describe("buildCalculatorRequestPayload", () => {
  it("9. never includes a userId/telegramId field", () => {
    const config = getBannerConfig(BannerFamily.EXCLUSIVE_AGENT);
    const state = createDefaultFamilyFormState();
    const payload = buildCalculatorRequestPayload(BannerFamily.EXCLUSIVE_AGENT, state, config);

    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("telegramId");
    expect(JSON.stringify(payload)).not.toMatch(/userId|telegramId/i);
  });

  it("10. saved mode sends no overrides at all", () => {
    const config = getBannerConfig(BannerFamily.EXCLUSIVE_AGENT);
    const state = {
      ...createDefaultFamilyFormState(),
      useSavedResources: true,
      useSavedBannerState: true,
    };
    const payload = buildCalculatorRequestPayload(BannerFamily.EXCLUSIVE_AGENT, state, config);

    expect(payload.resourceOverrides).toBeUndefined();
    expect(payload.bannerStateOverrides).toBeUndefined();
    expect(payload.useSavedResources).toBe(true);
    expect(payload.useSavedBannerState).toBe(true);
  });

  it("11. temporary mode sends only fields relevant to Exclusive Agent (encryptedMasterTape, not masterTape/boopon)", () => {
    const config = getBannerConfig(BannerFamily.EXCLUSIVE_AGENT);
    const state = {
      ...createDefaultFamilyFormState(),
      useSavedResources: false,
      useSavedBannerState: false,
      resources: {
        polychrome: "320",
        monochrome: "0",
        encryptedMasterTape: "2",
        masterTape: "0",
        boopon: "0",
        includeMonochrome: false,
      },
      bannerState: { sRankPity: "70", aRankPity: "5", guaranteeActive: true },
    };
    const payload = buildCalculatorRequestPayload(BannerFamily.EXCLUSIVE_AGENT, state, config);

    expect(payload.resourceOverrides).toEqual({
      polychrome: 320,
      monochrome: 0,
      includeMonochrome: false,
      encryptedMasterTape: 2,
    });
    expect(payload.resourceOverrides).not.toHaveProperty("masterTape");
    expect(payload.resourceOverrides).not.toHaveProperty("boopon");
    expect(payload.bannerStateOverrides).toEqual({ sRankPity: 70, aRankPity: 5, guaranteeActive: true });
  });

  it("11. temporary mode sends only Boopon for Bangboo (no polychrome/tape fields, no guarantee override)", () => {
    const config = getBannerConfig(BannerFamily.BANGBOO);
    const state = {
      ...createDefaultFamilyFormState(),
      useSavedResources: false,
      useSavedBannerState: false,
      resources: { polychrome: "0", monochrome: "0", encryptedMasterTape: "0", masterTape: "0", boopon: "12", includeMonochrome: false },
      bannerState: { sRankPity: "70", aRankPity: "5", guaranteeActive: false },
    };
    const payload = buildCalculatorRequestPayload(BannerFamily.BANGBOO, state, config);

    expect(payload.resourceOverrides).toEqual({ boopon: 12 });
    expect(payload.bannerStateOverrides).toEqual({ sRankPity: 70, aRankPity: 5 });
    expect(payload.bannerStateOverrides).not.toHaveProperty("guaranteeActive");
  });

  it("sends targetCopies=1 as a technical placeholder for Stable, ignoring the (unused) form field", () => {
    const config = getBannerConfig(BannerFamily.STABLE);
    const state = { ...createDefaultFamilyFormState(), targetCopies: "" };
    const payload = buildCalculatorRequestPayload(BannerFamily.STABLE, state, config);
    expect(payload.targetCopies).toBe(1);
  });
});
