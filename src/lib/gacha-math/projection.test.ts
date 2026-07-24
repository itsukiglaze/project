import { describe, expect, it } from "vitest";
import {
  calculateDailyAverage,
  calculateProjectedGoalDate,
  calculateProjectedGoalDateByPulls,
} from "./projection";

const START = new Date("2026-07-23T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("calculateProjectedGoalDate", () => {
  it("37. missingPulls = 0 -> returns the start date", () => {
    const result = calculateProjectedGoalDate({
      missingPulls: 0,
      averagePolychromePerDay: 100,
      startDate: START,
    });
    expect(result?.getTime()).toBe(START.getTime());
  });

  it("38. average = 0 -> null (goal unreachable)", () => {
    const result = calculateProjectedGoalDate({
      missingPulls: 5,
      averagePolychromePerDay: 0,
      startDate: START,
    });
    expect(result).toBeNull();
  });

  it("negative average -> null", () => {
    const result = calculateProjectedGoalDate({
      missingPulls: 5,
      averagePolychromePerDay: -10,
      startDate: START,
    });
    expect(result).toBeNull();
  });

  it("negative missingPulls -> null (invalid state, not guessed)", () => {
    const result = calculateProjectedGoalDate({
      missingPulls: -1,
      averagePolychromePerDay: 100,
      startDate: START,
    });
    expect(result).toBeNull();
  });

  it("39. 10 missing pulls at 160 polychrome/day -> 10 days", () => {
    const result = calculateProjectedGoalDate({
      missingPulls: 10,
      averagePolychromePerDay: 160,
      startDate: START,
    });
    expect(result?.getTime()).toBe(START.getTime() + 10 * DAY_MS);
  });

  it("40. rounds the day count up, never down", () => {
    // 10 pulls * 160 = 1600 polychrome needed; at 300/day that's 5.33 days -> 6.
    const result = calculateProjectedGoalDate({
      missingPulls: 10,
      averagePolychromePerDay: 300,
      startDate: START,
    });
    expect(result?.getTime()).toBe(START.getTime() + 6 * DAY_MS);
  });

  it("does not reinterpret startDate in any timezone — pure instant + day offset", () => {
    const result = calculateProjectedGoalDate({
      missingPulls: 1,
      averagePolychromePerDay: 160,
      startDate: START,
    });
    expect(result?.toISOString()).toBe("2026-07-24T00:00:00.000Z");
  });
});

describe("calculateProjectedGoalDateByPulls (Bangboo/Boopon)", () => {
  it("uses averagePullsPerDay directly, no Polychrome conversion", () => {
    const result = calculateProjectedGoalDateByPulls({
      missingPulls: 10,
      averagePullsPerDay: 2,
      startDate: START,
    });
    expect(result?.getTime()).toBe(START.getTime() + 5 * DAY_MS);
  });

  it("average = 0 -> null", () => {
    expect(
      calculateProjectedGoalDateByPulls({
        missingPulls: 5,
        averagePullsPerDay: 0,
        startDate: START,
      }),
    ).toBeNull();
  });
});

describe("calculateDailyAverage", () => {
  it("returns 0 for an empty sample instead of NaN", () => {
    expect(calculateDailyAverage([])).toBe(0);
  });

  it("computes the arithmetic mean", () => {
    expect(calculateDailyAverage([100, 200, 300])).toBe(200);
  });
});
