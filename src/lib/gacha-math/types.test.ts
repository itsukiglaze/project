import { describe, expect, it } from "vitest";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import {
  validateBannerStateInput,
  validatePullGoalInput,
  validateResourceInput,
} from "./types";

const config = getBannerConfig(BannerFamily.EXCLUSIVE_AGENT);

describe("validateBannerStateInput", () => {
  it("29. rejects negative pity", () => {
    const result = validateBannerStateInput(
      { family: config.family, sRankPity: -1, aRankPity: 0, guaranteeActive: false },
      config.hardPityS,
      config.hardPityA,
    );
    expect(result.ok).toBe(false);
  });

  it("30. rejects pity equal to hard pity (a stored 'pulls since last S-rank' can never equal hard pity — that S-rank would already have happened)", () => {
    const result = validateBannerStateInput(
      { family: config.family, sRankPity: config.hardPityS, aRankPity: 0, guaranteeActive: false },
      config.hardPityS,
      config.hardPityA,
    );
    expect(result.ok).toBe(false);
  });

  it("accepts pity one below hard pity (the maximum valid stored value)", () => {
    const result = validateBannerStateInput(
      {
        family: config.family,
        sRankPity: config.hardPityS - 1,
        aRankPity: 0,
        guaranteeActive: false,
      },
      config.hardPityS,
      config.hardPityA,
    );
    expect(result.ok).toBe(true);
  });

  it("33. rejects NaN and Infinity pity", () => {
    const nan = validateBannerStateInput(
      { family: config.family, sRankPity: NaN, aRankPity: 0, guaranteeActive: false },
      config.hardPityS,
      config.hardPityA,
    );
    const infinity = validateBannerStateInput(
      { family: config.family, sRankPity: Infinity, aRankPity: 0, guaranteeActive: false },
      config.hardPityS,
      config.hardPityA,
    );
    expect(nan.ok).toBe(false);
    expect(infinity.ok).toBe(false);
  });
});

describe("validateResourceInput", () => {
  it("32. rejects fractional cassette counts", () => {
    const result = validateResourceInput({
      polychrome: 0,
      monochrome: 0,
      encryptedMasterTape: 1.5,
      masterTape: 0,
      boopon: 0,
      includeMonochrome: false,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects negative resources", () => {
    const result = validateResourceInput({
      polychrome: -1,
      monochrome: 0,
      encryptedMasterTape: 0,
      masterTape: 0,
      boopon: 0,
      includeMonochrome: false,
    });
    expect(result.ok).toBe(false);
  });

  it("33. rejects NaN/Infinity resource amounts", () => {
    const nan = validateResourceInput({
      polychrome: NaN,
      monochrome: 0,
      encryptedMasterTape: 0,
      masterTape: 0,
      boopon: 0,
      includeMonochrome: false,
    });
    const infinity = validateResourceInput({
      polychrome: Infinity,
      monochrome: 0,
      encryptedMasterTape: 0,
      masterTape: 0,
      boopon: 0,
      includeMonochrome: false,
    });
    expect(nan.ok).toBe(false);
    expect(infinity.ok).toBe(false);
  });
});

describe("validatePullGoalInput", () => {
  it("31. rejects targetCopies = 0", () => {
    expect(validatePullGoalInput({ family: config.family, targetCopies: 0 }).ok).toBe(false);
  });

  it("accepts targetCopies = 1", () => {
    expect(validatePullGoalInput({ family: config.family, targetCopies: 1 }).ok).toBe(true);
  });

  it("33. rejects NaN/Infinity targetCopies", () => {
    expect(validatePullGoalInput({ family: config.family, targetCopies: NaN }).ok).toBe(false);
    expect(validatePullGoalInput({ family: config.family, targetCopies: Infinity }).ok).toBe(false);
  });
});
