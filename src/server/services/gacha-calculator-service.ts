import "server-only";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import {
  calculateGuaranteedTargetResult,
  validateBannerStateInput,
  validatePullGoalInput,
  validateResourceInput,
  type BannerStateInput,
  type GuaranteedTargetResult,
  type ResourceInput,
} from "@/lib/gacha-math";
import { getBannerState } from "@/server/repositories/banner-state-repository";
import { getResourceBalance } from "@/server/repositories/resource-balance-repository";

export type CalculatorServiceInput = {
  /**
   * MUST come from the caller's own session lookup (getCurrentUser()) —
   * never from request body/query. This service has no other way to know
   * which user it's running for, and every repository call below is
   * scoped strictly to this id.
   */
  userId: string;
  family: BannerFamily;
  targetCopies: number;
  useSavedResources: boolean;
  useSavedBannerState: boolean;
  resourceOverrides?: Partial<ResourceInput>;
  bannerStateOverrides?: Partial<BannerStateInput>;
};

export type CalculatorServiceResult =
  | { ok: true; data: GuaranteedTargetResult }
  | { ok: false; errors: string[] };

const DEFAULT_BANNER_STATE_FIELDS: Omit<BannerStateInput, "family"> = {
  sRankPity: 0,
  aRankPity: 0,
  guaranteeActive: false,
};

const DEFAULT_RESOURCE_FIELDS: Omit<ResourceInput, "includeMonochrome"> = {
  polychrome: 0,
  monochrome: 0,
  encryptedMasterTape: 0,
  masterTape: 0,
  boopon: 0,
};

async function resolveBannerState(input: CalculatorServiceInput): Promise<BannerStateInput> {
  const saved = input.useSavedBannerState
    ? await getBannerState(input.userId, input.family)
    : null;

  const base: BannerStateInput = saved ?? {
    family: input.family,
    ...DEFAULT_BANNER_STATE_FIELDS,
  };

  // Overrides apply on top and are never written back anywhere.
  return { ...base, ...input.bannerStateOverrides, family: input.family };
}

async function resolveResources(input: CalculatorServiceInput): Promise<ResourceInput> {
  const includeMonochrome = input.resourceOverrides?.includeMonochrome ?? false;

  const saved = input.useSavedResources
    ? await getResourceBalance(input.userId, includeMonochrome)
    : null;

  const base: ResourceInput = saved ?? { ...DEFAULT_RESOURCE_FIELDS, includeMonochrome };

  return { ...base, ...input.resourceOverrides };
}

/**
 * Runs one calculator plan for the current user. Read-only: no pity or
 * balance row is ever written by this function, and overrides supplied in
 * `input` live only for the duration of this call — nothing here persists
 * them.
 *
 * All the actual arithmetic lives in src/lib/gacha-math/* — this service
 * only resolves inputs (saved vs. override) and validates them before
 * handing off to the pure calculation layer.
 */
export async function calculateGachaPlan(
  input: CalculatorServiceInput,
): Promise<CalculatorServiceResult> {
  const config = getBannerConfig(input.family);

  const bannerState = await resolveBannerState(input);
  const resources = await resolveResources(input);

  const bannerStateValidation = validateBannerStateInput(
    bannerState,
    config.hardPityS,
    config.hardPityA,
  );
  if (!bannerStateValidation.ok) {
    return { ok: false, errors: bannerStateValidation.errors };
  }

  const resourceValidation = validateResourceInput(resources);
  if (!resourceValidation.ok) {
    return { ok: false, errors: resourceValidation.errors };
  }

  const goalValidation = validatePullGoalInput({
    family: input.family,
    targetCopies: input.targetCopies,
  });
  if (!goalValidation.ok) {
    return { ok: false, errors: goalValidation.errors };
  }

  const data = calculateGuaranteedTargetResult({
    family: input.family,
    bannerState: bannerStateValidation.value,
    resources: resourceValidation.value,
    targetCopies: input.targetCopies,
  });

  return { ok: true, data };
}
