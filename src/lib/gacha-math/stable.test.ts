import { describe, expect, it } from "vitest";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { calculateRemainingToHardPityFor } from "./pity";
import { calculateGuaranteedTargetResult } from "./index";
import { isUnsupportedTarget } from "./types";

const config = getBannerConfig(BannerFamily.STABLE);

describe("Stable channel", () => {
  it("27. distance to next S-rank at pity 70 -> 20", () => {
    expect(calculateRemainingToHardPityFor(config, 70)).toBe(20);
  });

  it("28. a specific target copy request returns UNSUPPORTED_TARGET, never a fabricated number", () => {
    const result = calculateGuaranteedTargetResult({
      family: BannerFamily.STABLE,
      bannerState: { family: BannerFamily.STABLE, sRankPity: 70, aRankPity: 0, guaranteeActive: false },
      resources: {
        polychrome: 0,
        monochrome: 0,
        encryptedMasterTape: 0,
        masterTape: 3,
        boopon: 0,
        includeMonochrome: false,
      },
      targetCopies: 1,
    });

    expect(isUnsupportedTarget(result)).toBe(true);
    if (isUnsupportedTarget(result)) {
      expect(result.kind).toBe("UNSUPPORTED_TARGET");
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});
