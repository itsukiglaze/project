import { describe, expect, it } from "vitest";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { calculateAdditionalTargetsWorstCase, calculateTargetCopiesWorstCase } from "./guarantee";

const config = getBannerConfig(BannerFamily.W_ENGINE);

function worstCase(sRankPity: number, guaranteeActive: boolean, targetCopies = 1) {
  return calculateTargetCopiesWorstCase(config, sRankPity, guaranteeActive, targetCopies);
}

describe("W-Engine worst case", () => {
  it("18. pity 0, guarantee false -> 160", () => {
    expect(worstCase(0, false).totalRequiredPulls).toBe(160);
  });

  it("19. pity 60, guarantee false -> 100", () => {
    expect(worstCase(60, false).totalRequiredPulls).toBe(100);
  });

  it("20. pity 60, guarantee true -> 20", () => {
    expect(worstCase(60, true).totalRequiredPulls).toBe(20);
  });

  it("21. an additional copy costs at most 160 (2x hard pity of 80)", () => {
    expect(calculateAdditionalTargetsWorstCase(config)).toBe(160);
  });

  it("regression: MVP hard pity constant is 80 (guards against silent config drift)", () => {
    expect(config.hardPityS).toBe(80);
  });
});
