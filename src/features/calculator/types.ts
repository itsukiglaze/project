import { BannerFamily, PullCurrency, getBannerConfig, type BannerConfig } from "@/config/gacha";
import type { GuaranteedCalculationResult, UnsupportedGuaranteedTarget } from "@/lib/gacha-math";

export const ALL_FAMILIES: BannerFamily[] = [
  BannerFamily.EXCLUSIVE_AGENT,
  BannerFamily.W_ENGINE,
  BannerFamily.STABLE,
  BannerFamily.BANGBOO,
];

/**
 * S0–S6 is specifically the character-duplicate convention (S0 = the
 * character itself, S1–S6 = duplicate ranks 1–6) — it does not describe a
 * W-Engine or a Bangboo. Internally this is still exactly the same 1–7
 * `targetCopies` count either way (S0=1, S1=2, …, S6=7); only the label
 * differs. Shared between goal-fields.tsx (the chip control) and the
 * calculation summary, so both describe the same goal identically.
 */
export function isCharacterBanner(family: BannerFamily): boolean {
  return family === BannerFamily.EXCLUSIVE_AGENT;
}

export function goalChipLabel(family: BannerFamily, copies: number): string {
  return isCharacterBanner(family) ? `S${copies - 1}` : `Копия ${copies}`;
}

/** UI copy only — no game-balance numbers live here, those all come from config/gacha.ts. */
export const FAMILY_LABELS: Record<BannerFamily, string> = {
  [BannerFamily.EXCLUSIVE_AGENT]: "Эксклюзивный агент",
  [BannerFamily.W_ENGINE]: "W-Engine",
  [BannerFamily.STABLE]: "Стабильный канал",
  [BannerFamily.BANGBOO]: "Bangboo",
};

export const CURRENCY_LABELS: Record<PullCurrency, string> = {
  [PullCurrency.ENCRYPTED_MASTER_TAPE]: "Шифр-кассета",
  [PullCurrency.MASTER_TAPE]: "Обычная кассета",
  [PullCurrency.BOOPON]: "Boopon",
};

/**
 * "featured / off-banner" split as a "50/50"-style string, purely for
 * display — derived from the existing `featuredBaseChance` config value
 * (previously stored but never rendered anywhere). Only meaningful for
 * families with a real featured-vs-off-banner split; callers must check
 * that first (see getMechanismLabel).
 */
function formatFeaturedSplit(featuredBaseChance: number): string {
  const featuredPercent = Math.round(featuredBaseChance * 100);
  return `${featuredPercent}/${100 - featuredPercent}`;
}

/**
 * Compact "Механика: …" line shown under the selected banner — one banner
 * family's actual mechanism, not a generic reused phrase. Exclusive Agent
 * and W-Engine have DIFFERENT featured/off-banner splits (50/50 vs
 * 75/25); this must read that from config per family, never hard-code
 * "50/50" for both.
 */
export function getMechanismLabel(config: BannerConfig): string {
  if (config.selectedTargetAlways) {
    return "выбранная цель гарантирована";
  }
  if (config.family === BannerFamily.STABLE) {
    return "любой S-ранг, без гарантии цели";
  }
  if (config.guaranteeAfterOffBanner && config.featuredBaseChance !== null) {
    return formatFeaturedSplit(config.featuredBaseChance);
  }
  return "гарантия цели не предусмотрена";
}

/** Derives a one-line guarantee summary purely from config values. */
export function getGuaranteeSummary(config: BannerConfig): string {
  if (config.family === BannerFamily.STABLE) {
    return "Гарантирован любой S-ранг раз в hard pity — без гарантии конкретного персонажа или W-Engine.";
  }
  if (config.selectedTargetAlways) {
    return "Выбранный Bangboo гарантирован при каждом S-ранге этого канала.";
  }
  if (config.guaranteeAfterOffBanner && config.featuredBaseChance !== null) {
    return `После проигранного ${formatFeaturedSplit(config.featuredBaseChance)} следующий S-ранг гарантированно целевой.`;
  }
  return "Гарантия конкретной цели не предусмотрена.";
}

export function getFamilyDisplayInfo(family: BannerFamily) {
  const config = getBannerConfig(family);
  return {
    family,
    label: FAMILY_LABELS[family],
    hardPityS: config.hardPityS,
    currencyLabel: CURRENCY_LABELS[config.currency],
    mechanismLabel: getMechanismLabel(config),
    guaranteeSummary: getGuaranteeSummary(config),
  };
}

// ---------------------------------------------------------------------------
// Form state — raw string fields so an in-progress/empty input is never
// silently coerced to 0 while the user is typing (requirement 4).
// ---------------------------------------------------------------------------

export type ResourceFieldsState = {
  polychrome: string;
  monochrome: string;
  encryptedMasterTape: string;
  masterTape: string;
  boopon: string;
  includeMonochrome: boolean;
};

export type BannerStateFieldsState = {
  sRankPity: string;
  aRankPity: string;
  guaranteeActive: boolean;
};

export type FamilyFormState = {
  useSavedResources: boolean;
  useSavedBannerState: boolean;
  resources: ResourceFieldsState;
  bannerState: BannerStateFieldsState;
  targetCopies: string;
};

export type CalculatorFormState = Record<BannerFamily, FamilyFormState>;

export const EMPTY_RESOURCE_FIELDS: ResourceFieldsState = {
  polychrome: "",
  monochrome: "",
  encryptedMasterTape: "",
  masterTape: "",
  boopon: "",
  includeMonochrome: false,
};

export const EMPTY_BANNER_STATE_FIELDS: BannerStateFieldsState = {
  sRankPity: "",
  aRankPity: "",
  guaranteeActive: false,
};

export function createDefaultFamilyFormState(): FamilyFormState {
  return {
    useSavedResources: true,
    useSavedBannerState: true,
    resources: { ...EMPTY_RESOURCE_FIELDS },
    bannerState: { ...EMPTY_BANNER_STATE_FIELDS },
    targetCopies: "1",
  };
}

export function createDefaultCalculatorFormState(): CalculatorFormState {
  return ALL_FAMILIES.reduce((state, family) => {
    state[family] = createDefaultFamilyFormState();
    return state;
  }, {} as CalculatorFormState);
}

// ---------------------------------------------------------------------------
// UI-level result wrapper (network/validation/auth states around the pure
// CalculatorSuccessResponse from api.ts)
// ---------------------------------------------------------------------------

export type CalculatorUiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "calculated"; data: GuaranteedCalculationResult; stale: boolean }
  | { status: "unsupported"; data: UnsupportedGuaranteedTarget; stale: boolean }
  | { status: "validation_error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "auth_error"; message: string }
  | { status: "network_error" }
  | { status: "unknown_error"; message: string };
