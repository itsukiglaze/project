import { BannerFamily, POLYCHROME_PER_PULL, PullCurrency, getBannerConfig } from "@/config/gacha";
import type { ResourceInput } from "./types";

export type PullsFromPolychrome = {
  pulls: number;
  /** Polychrome left over after the integer division — never negative. */
  leftover: number;
};

/** How many whole pulls a given amount of Polychrome buys, and the remainder. */
export function calculatePullsFromPolychrome(polychrome: number): PullsFromPolychrome {
  const pulls = Math.floor(polychrome / POLYCHROME_PER_PULL);
  const leftover = polychrome - pulls * POLYCHROME_PER_PULL;
  return { pulls, leftover };
}

export type AvailablePullsResult = {
  availablePulls: number;
  /**
   * Polychrome (and, if included, Monochrome) left over after conversion.
   * For Bangboo (which never consumes Polychrome), this simply passes the
   * Polychrome balance through untouched.
   */
  leftoverPolychrome: number;
};

/**
 * Available pulls for a single banner family. Currencies are never summed
 * across families — each family only ever draws on its own pull-token
 * currency plus (where applicable) Polychrome/Monochrome.
 */
export function calculateAvailablePulls(
  family: BannerFamily,
  resources: ResourceInput,
): AvailablePullsResult {
  const config = getBannerConfig(family);

  if (config.currency === PullCurrency.BOOPON) {
    // Requirement: Polychrome can never be used for Bangboo.
    return { availablePulls: resources.boopon, leftoverPolychrome: resources.polychrome };
  }

  const effectivePolychrome =
    resources.polychrome + (resources.includeMonochrome ? resources.monochrome : 0);
  const { pulls: pullsFromPolychrome, leftover } = calculatePullsFromPolychrome(effectivePolychrome);

  const tapeCount =
    config.currency === PullCurrency.ENCRYPTED_MASTER_TAPE
      ? resources.encryptedMasterTape
      : resources.masterTape;

  return {
    availablePulls: tapeCount + pullsFromPolychrome,
    leftoverPolychrome: leftover,
  };
}

/** max(0, required - available) — never negative. */
export function calculateMissingPulls(totalRequiredPulls: number, availablePulls: number): number {
  return Math.max(0, totalRequiredPulls - availablePulls);
}

/**
 * Polychrome needed to close a pull shortfall, for families whose pull
 * token can be bought with Polychrome. Returns null for Bangboo, where
 * Polychrome is not a valid substitute (requirement 4/7).
 */
export function calculateMissingPolychrome(
  family: BannerFamily,
  missingPulls: number,
): number | null {
  const config = getBannerConfig(family);
  if (config.currency === PullCurrency.BOOPON) return null;
  return missingPulls * POLYCHROME_PER_PULL;
}
