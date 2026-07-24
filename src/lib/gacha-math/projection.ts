import { POLYCHROME_PER_PULL } from "@/config/gacha";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ProjectedGoalDateInput = {
  missingPulls: number;
  averagePolychromePerDay: number;
  startDate: Date;
};

/**
 * Projects the calendar date a Polychrome-funded goal (Exclusive Agent,
 * W-Engine, Stable) would be reached at the given daily average income.
 *
 * This is pure day-count arithmetic added to `startDate`'s own instant —
 * it deliberately does NOT reinterpret `startDate` in any timezone.
 * Whoever calls this is responsible for constructing `startDate` from the
 * user's own local calendar day beforehand.
 *
 * Returns null when a projection isn't meaningful:
 *   - averagePolychromePerDay <= 0 (no income, or invalid input) — can't
 *     ever reach a goal that requires more resources;
 *   - missingPulls < 0 — invalid state, refuse to guess.
 */
export function calculateProjectedGoalDate(input: ProjectedGoalDateInput): Date | null {
  const { missingPulls, averagePolychromePerDay, startDate } = input;

  if (missingPulls < 0) return null;
  if (missingPulls === 0) return new Date(startDate.getTime());
  if (averagePolychromePerDay <= 0) return null;

  const neededDays = Math.ceil((missingPulls * POLYCHROME_PER_PULL) / averagePolychromePerDay);
  return new Date(startDate.getTime() + neededDays * MS_PER_DAY);
}

export type ProjectedGoalDateByPullsInput = {
  missingPulls: number;
  /** Average pulls-worth of the family's own token earned per day (e.g. Boopon for Bangboo). */
  averagePullsPerDay: number;
  startDate: Date;
};

/**
 * Same idea as calculateProjectedGoalDate, but for families whose pull
 * token is NOT bought with Polychrome (Bangboo/Boopon) — requirement 10
 * explicitly forbids reusing averagePolychromePerDay for Bangboo.
 */
export function calculateProjectedGoalDateByPulls(
  input: ProjectedGoalDateByPullsInput,
): Date | null {
  const { missingPulls, averagePullsPerDay, startDate } = input;

  if (missingPulls < 0) return null;
  if (missingPulls === 0) return new Date(startDate.getTime());
  if (averagePullsPerDay <= 0) return null;

  const neededDays = Math.ceil(missingPulls / averagePullsPerDay);
  return new Date(startDate.getTime() + neededDays * MS_PER_DAY);
}

/** Simple arithmetic mean; returns 0 for an empty sample rather than NaN. */
export function calculateDailyAverage(dailyAmounts: number[]): number {
  if (dailyAmounts.length === 0) return 0;
  const sum = dailyAmounts.reduce((total, value) => total + value, 0);
  return sum / dailyAmounts.length;
}
