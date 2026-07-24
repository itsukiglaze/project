import type { BannerConfig } from "@/config/gacha";

/**
 * Pulls remaining until the next hard-pity S-rank is guaranteed, given the
 * caller has already validated `currentPity` is in [0, hardPityS).
 */
export function calculateRemainingToHardPity(currentPity: number, hardPityS: number): number {
  return hardPityS - currentPity;
}

/** Same idea, reading hardPityS off a BannerConfig for convenience. */
export function calculateRemainingToHardPityFor(
  config: BannerConfig,
  currentPity: number,
): number {
  return calculateRemainingToHardPity(currentPity, config.hardPityS);
}
