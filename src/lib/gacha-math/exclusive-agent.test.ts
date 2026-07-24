import { describe, expect, it } from "vitest";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { calculateTargetCopiesWorstCase } from "./guarantee";

const config = getBannerConfig(BannerFamily.EXCLUSIVE_AGENT);

function worstCase(sRankPity: number, guaranteeActive: boolean, targetCopies = 1) {
  return calculateTargetCopiesWorstCase(config, sRankPity, guaranteeActive, targetCopies);
}

describe("Exclusive Agent worst case", () => {
  it("10. pity 0, guarantee false, 1 copy -> 180", () => {
    expect(worstCase(0, false).totalRequiredPulls).toBe(180);
  });

  it("11. pity 70, guarantee false -> 110", () => {
    expect(worstCase(70, false).totalRequiredPulls).toBe(110);
  });

  it("12. pity 70, guarantee true -> 20", () => {
    expect(worstCase(70, true).totalRequiredPulls).toBe(20);
  });

  it("13. pity 89, guarantee true -> 1", () => {
    expect(worstCase(89, true).totalRequiredPulls).toBe(1);
  });

  it("14. pity 89, guarantee false -> 91", () => {
    expect(worstCase(89, false).totalRequiredPulls).toBe(91);
  });

  it("15. 2 copies, pity 70, guarantee true -> 200", () => {
    expect(worstCase(70, true, 2).totalRequiredPulls).toBe(200);
  });

  it("16. 2 copies, pity 70, guarantee false -> 290", () => {
    expect(worstCase(70, false, 2).totalRequiredPulls).toBe(290);
  });

  it("17. additional copies never re-apply the current pity", () => {
    const one = worstCase(70, true, 1);
    const two = worstCase(70, true, 2);
    const three = worstCase(70, true, 3);

    // Each extra copy adds a constant amount (2x hard pity) — current
    // pity/guarantee only ever affects `firstTargetCost`, once.
    expect(two.totalRequiredPulls - one.totalRequiredPulls).toBe(config.hardPityS * 2);
    expect(three.totalRequiredPulls - two.totalRequiredPulls).toBe(config.hardPityS * 2);
    expect(one.firstTargetCost).toBe(two.firstTargetCost);
    expect(two.firstTargetCost).toBe(three.firstTargetCost);
  });

  it("regression: MVP hard pity constant is 90 (guards against silent config drift)", () => {
    expect(config.hardPityS).toBe(90);
  });
});
