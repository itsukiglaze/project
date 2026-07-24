import { describe, expect, it } from "vitest";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { calculateTargetCopiesWorstCase } from "./guarantee";
import { calculateAvailablePulls } from "./resources";
import type { ResourceInput } from "./types";

const config = getBannerConfig(BannerFamily.BANGBOO);

function worstCase(sRankPity: number, guaranteeActive: boolean, targetCopies = 1) {
  return calculateTargetCopiesWorstCase(config, sRankPity, guaranteeActive, targetCopies);
}

describe("Bangboo worst case", () => {
  it("22. pity 0, 1 copy -> 80", () => {
    expect(worstCase(0, false).totalRequiredPulls).toBe(80);
  });

  it("23. pity 70, 1 copy -> 10", () => {
    expect(worstCase(70, false).totalRequiredPulls).toBe(10);
  });

  it("24. pity 70, 2 copies -> 90", () => {
    expect(worstCase(70, false, 2).totalRequiredPulls).toBe(90);
  });

  it("25. guaranteeActive does not change the result — the selected Bangboo is always guaranteed", () => {
    expect(worstCase(70, false, 2).totalRequiredPulls).toBe(worstCase(70, true, 2).totalRequiredPulls);
    expect(worstCase(0, false).totalRequiredPulls).toBe(worstCase(0, true).totalRequiredPulls);
  });

  it("26. Polychrome never increases available Bangboo pulls", () => {
    const resources: ResourceInput = {
      polychrome: 1_000_000,
      monochrome: 0,
      encryptedMasterTape: 0,
      masterTape: 0,
      boopon: 5,
      includeMonochrome: true,
    };
    expect(calculateAvailablePulls(BannerFamily.BANGBOO, resources).availablePulls).toBe(5);
  });

  it("regression: MVP hard pity constant is 80 (guards against silent config drift)", () => {
    expect(config.hardPityS).toBe(80);
  });
});
