/**
 * Single source of truth for ZZZ gacha constants.
 *
 * Nothing outside this file should hard-code a hard-pity number, a
 * featured-chance value, or a guarantee rule — every formula in
 * `src/lib/gacha-math/*` reads those values from here, so changing a
 * constant never requires touching a formula or rewriting its tests.
 *
 * Deliberately NOT included on this stage: any soft-pity probability
 * curve. Only hard-pity and worst-case guarantee math are implemented;
 * `featuredBaseChance` is stored for future use but is not yet consumed by
 * any calculation.
 */

export enum BannerFamily {
  EXCLUSIVE_AGENT = "EXCLUSIVE_AGENT",
  W_ENGINE = "W_ENGINE",
  STABLE = "STABLE",
  BANGBOO = "BANGBOO",
}

/**
 * The discrete "pull token" currency a banner family is drawn with, as
 * opposed to `CurrencyType` (the wallet-level currencies a user accrues,
 * e.g. Polychrome/Monochrome). Kept as a separate concept on purpose per
 * requirement 6 of the original spec ("не смешивай один enum для описания
 * одновременно вероятности featured и механики гарантии" — likewise here,
 * a pull-token currency is not the same axis as a wallet currency).
 */
export enum PullCurrency {
  ENCRYPTED_MASTER_TAPE = "ENCRYPTED_MASTER_TAPE",
  MASTER_TAPE = "MASTER_TAPE",
  BOOPON = "BOOPON",
}

export type BannerConfig = {
  family: BannerFamily;
  /** Number of pulls after which an S-rank is guaranteed. */
  hardPityS: number;
  /** Number of pulls after which an A-rank or higher is guaranteed. */
  hardPityA: number;
  /** The pull-token currency this banner family is drawn with. */
  currency: PullCurrency;
  /**
   * Base probability that an S-rank pull is the featured item, independent
   * of the guarantee mechanic. `null` where the concept doesn't apply
   * (Stable has no single "featured" item; not yet used in any formula on
   * this stage — reserved for a future soft-pity/probability model).
   */
  featuredBaseChance: number | null;
  /**
   * If the most recent S-rank was NOT the featured item, the next S-rank
   * on this family is guaranteed to be featured.
   */
  guaranteeAfterOffBanner: boolean;
  /**
   * If true, every S-rank on this family is guaranteed to be the user's
   * currently selected target (used for Bangboo, where the selected
   * target can change without resetting pity — see banner_states.selectedBangbooId
   * in prisma/schema.prisma). `guaranteeAfterOffBanner` is meaningless when
   * this is true.
   */
  selectedTargetAlways: boolean;
  /**
   * Whether pity carries over between consecutive banners of this same
   * family (it never carries over BETWEEN families — see BannerState in
   * prisma/schema.prisma).
   */
  pityCarriesWithinFamily: boolean;
};

export const POLYCHROME_PER_PULL = 160;

export const BANNER_CONFIG: Record<BannerFamily, BannerConfig> = {
  [BannerFamily.EXCLUSIVE_AGENT]: {
    family: BannerFamily.EXCLUSIVE_AGENT,
    hardPityS: 90,
    hardPityA: 10,
    currency: PullCurrency.ENCRYPTED_MASTER_TAPE,
    featuredBaseChance: 0.5,
    guaranteeAfterOffBanner: true,
    selectedTargetAlways: false,
    pityCarriesWithinFamily: true,
  },
  [BannerFamily.W_ENGINE]: {
    family: BannerFamily.W_ENGINE,
    hardPityS: 80,
    hardPityA: 10,
    currency: PullCurrency.ENCRYPTED_MASTER_TAPE,
    featuredBaseChance: 0.75,
    guaranteeAfterOffBanner: true,
    selectedTargetAlways: false,
    pityCarriesWithinFamily: true,
  },
  [BannerFamily.STABLE]: {
    family: BannerFamily.STABLE,
    hardPityS: 90,
    hardPityA: 10,
    currency: PullCurrency.MASTER_TAPE,
    featuredBaseChance: null,
    guaranteeAfterOffBanner: false,
    selectedTargetAlways: false,
    pityCarriesWithinFamily: true,
  },
  [BannerFamily.BANGBOO]: {
    family: BannerFamily.BANGBOO,
    hardPityS: 80,
    hardPityA: 10,
    currency: PullCurrency.BOOPON,
    featuredBaseChance: 1,
    guaranteeAfterOffBanner: false,
    selectedTargetAlways: true,
    pityCarriesWithinFamily: true,
  },
};

export function getBannerConfig(family: BannerFamily): BannerConfig {
  return BANNER_CONFIG[family];
}
