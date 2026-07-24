import { describe, expect, it } from "vitest";
import { BannerFamily, POLYCHROME_PER_PULL } from "@/config/gacha";
import {
  calculateAvailablePulls,
  calculateMissingPolychrome,
  calculateMissingPulls,
  calculatePullsFromPolychrome,
} from "./resources";
import type { ResourceInput } from "./types";

function resources(overrides: Partial<ResourceInput> = {}): ResourceInput {
  return {
    polychrome: 0,
    monochrome: 0,
    encryptedMasterTape: 0,
    masterTape: 0,
    boopon: 0,
    includeMonochrome: false,
    ...overrides,
  };
}

describe("calculatePullsFromPolychrome", () => {
  it("1. 0 polychrome -> 0 pulls", () => {
    expect(calculatePullsFromPolychrome(0)).toEqual({ pulls: 0, leftover: 0 });
  });

  it("2. 159 polychrome -> 0 pulls, leftover 159", () => {
    expect(calculatePullsFromPolychrome(159)).toEqual({ pulls: 0, leftover: 159 });
  });

  it(`3. ${POLYCHROME_PER_PULL} polychrome -> 1 pull`, () => {
    expect(calculatePullsFromPolychrome(POLYCHROME_PER_PULL)).toEqual({ pulls: 1, leftover: 0 });
  });

  it("4. 321 polychrome -> 2 pulls, leftover 1", () => {
    expect(calculatePullsFromPolychrome(321)).toEqual({ pulls: 2, leftover: 1 });
  });
});

describe("calculateAvailablePulls", () => {
  it("5. encryptedMasterTape adds to Polychrome-derived pulls for Exclusive Agent", () => {
    const result = calculateAvailablePulls(
      BannerFamily.EXCLUSIVE_AGENT,
      resources({ encryptedMasterTape: 3, polychrome: 160 }),
    );
    expect(result.availablePulls).toBe(4);
    expect(result.leftoverPolychrome).toBe(0);
  });

  it("6. masterTape is only used for Stable, not Exclusive Agent/W-Engine", () => {
    const withMasterTapeOnly = resources({ masterTape: 5, polychrome: 0 });

    const exclusive = calculateAvailablePulls(BannerFamily.EXCLUSIVE_AGENT, withMasterTapeOnly);
    expect(exclusive.availablePulls).toBe(0);

    const stable = calculateAvailablePulls(BannerFamily.STABLE, withMasterTapeOnly);
    expect(stable.availablePulls).toBe(5);
  });

  it("7. boopon is only used for Bangboo", () => {
    const withBooponOnly = resources({ boopon: 12, polychrome: 1600 });

    const bangboo = calculateAvailablePulls(BannerFamily.BANGBOO, withBooponOnly);
    expect(bangboo.availablePulls).toBe(12);
    // Polychrome must never convert into Bangboo pulls.
    expect(bangboo.leftoverPolychrome).toBe(1600);

    const exclusive = calculateAvailablePulls(BannerFamily.EXCLUSIVE_AGENT, withBooponOnly);
    expect(exclusive.availablePulls).toBe(10); // 1600 / 160, boopon ignored
  });

  it("8. monochrome only counts when includeMonochrome is true", () => {
    const withMonochrome = resources({ polychrome: 0, monochrome: 160, includeMonochrome: false });
    expect(calculateAvailablePulls(BannerFamily.EXCLUSIVE_AGENT, withMonochrome).availablePulls).toBe(0);

    const included = { ...withMonochrome, includeMonochrome: true };
    expect(calculateAvailablePulls(BannerFamily.EXCLUSIVE_AGENT, included).availablePulls).toBe(1);
  });

  it("9. currencies of different families are never summed together", () => {
    const mixed = resources({
      encryptedMasterTape: 2,
      masterTape: 3,
      boopon: 4,
      polychrome: 0,
    });

    expect(calculateAvailablePulls(BannerFamily.EXCLUSIVE_AGENT, mixed).availablePulls).toBe(2);
    expect(calculateAvailablePulls(BannerFamily.W_ENGINE, mixed).availablePulls).toBe(2);
    expect(calculateAvailablePulls(BannerFamily.STABLE, mixed).availablePulls).toBe(3);
    expect(calculateAvailablePulls(BannerFamily.BANGBOO, mixed).availablePulls).toBe(4);
  });
});

describe("calculateMissingPulls / calculateMissingPolychrome", () => {
  it("34. more resources than required -> missingPulls is 0", () => {
    expect(calculateMissingPulls(100, 150)).toBe(0);
  });

  it("35. missingPolychrome is never negative", () => {
    expect(calculateMissingPolychrome(BannerFamily.EXCLUSIVE_AGENT, 0)).toBe(0);
    expect(calculateMissingPolychrome(BannerFamily.EXCLUSIVE_AGENT, 5)).toBe(5 * POLYCHROME_PER_PULL);
  });

  it("missingPolychrome is null for Bangboo (Polychrome cannot substitute for Boopon)", () => {
    expect(calculateMissingPolychrome(BannerFamily.BANGBOO, 10)).toBeNull();
  });
});
