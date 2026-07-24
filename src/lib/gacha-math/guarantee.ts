import type { BannerConfig } from "@/config/gacha";

/**
 * Worst-case pulls needed for the FIRST target copy on this family.
 *
 * - Exclusive Agent / W-Engine (`selectedTargetAlways: false`): the current
 *   S-rank pity only applies to the nearest hard pity. If the guarantee is
 *   already active, that hard pity IS the target (50/50 already lost).
 *   Otherwise, the worst case is losing that 50/50 too and needing a full
 *   extra cycle.
 * - Bangboo (`selectedTargetAlways: true`): every S-rank on this family is
 *   guaranteed to be the selected Bangboo, so `guaranteeActive` is
 *   irrelevant — worst case is simply reaching the next hard pity.
 *
 * Callers must not invoke this for Stable — Stable has no featured-item
 * guarantee at all (see gacha-math/index.ts, which routes Stable target
 * requests to UNSUPPORTED_TARGET before ever reaching this function).
 */
export function calculateFirstTargetWorstCase(
  config: BannerConfig,
  sRankPity: number,
  guaranteeActive: boolean,
): number {
  const remainingFirstS = config.hardPityS - sRankPity;

  if (config.selectedTargetAlways) {
    return remainingFirstS;
  }

  return guaranteeActive ? remainingFirstS : remainingFirstS + config.hardPityS;
}

/**
 * Worst-case pulls needed for EACH copy beyond the first.
 *
 * The guarantee earned by winning/losing the previous copy's 50/50 does
 * NOT carry over to the next copy — every additional copy is evaluated
 * from a fresh pity of 0 with no guarantee, except for Bangboo where the
 * selected target is always guaranteed (so no "lost 50/50" cycle exists).
 */
export function calculateAdditionalTargetsWorstCase(config: BannerConfig): number {
  return config.selectedTargetAlways ? config.hardPityS : config.hardPityS * 2;
}

export type TargetCopiesWorstCase = {
  firstTargetCost: number;
  additionalTargetCost: number;
  totalRequiredPulls: number;
};

/**
 * Full worst-case cost for `targetCopies` copies of the featured/selected
 * target on a single family. The current pity/guarantee state is applied
 * ONLY to the first copy — never re-applied to subsequent copies.
 *
 * Not valid for Stable (see calculateFirstTargetWorstCase docs above).
 */
export function calculateTargetCopiesWorstCase(
  config: BannerConfig,
  sRankPity: number,
  guaranteeActive: boolean,
  targetCopies: number,
): TargetCopiesWorstCase {
  const firstTargetCost = calculateFirstTargetWorstCase(config, sRankPity, guaranteeActive);
  const additionalTargetCost = calculateAdditionalTargetsWorstCase(config);
  const totalRequiredPulls = firstTargetCost + additionalTargetCost * (targetCopies - 1);

  return { firstTargetCost, additionalTargetCost, totalRequiredPulls };
}
