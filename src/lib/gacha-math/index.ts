import { BannerFamily, getBannerConfig } from "@/config/gacha";
import type {
  BannerStateInput,
  ResourceInput,
  GuaranteedTargetResult,
} from "./types";
import { calculateAvailablePulls, calculateMissingPulls, calculateMissingPolychrome } from "./resources";
import { calculateTargetCopiesWorstCase } from "./guarantee";

export * from "./types";
export * from "./resources";
export * from "./pity";
export * from "./guarantee";
export * from "./projection";

export type CalculateGuaranteedTargetParams = {
  family: BannerFamily;
  bannerState: BannerStateInput;
  resources: ResourceInput;
  targetCopies: number;
};

/**
 * The single entry point that composes pity/guarantee math, resource
 * conversion and the shortfall calculation into the full result shape the
 * UI/API needs.
 *
 * Assumes `bannerState`/`resources`/`targetCopies` have ALREADY been
 * validated (see `validateBannerStateInput`, `validateResourceInput`,
 * `validatePullGoalInput` in ./types, or the Zod schema at the API
 * boundary) — this function does not re-validate or clamp anything.
 */
export function calculateGuaranteedTargetResult(
  params: CalculateGuaranteedTargetParams,
): GuaranteedTargetResult {
  const { family, bannerState, resources, targetCopies } = params;

  const { availablePulls, leftoverPolychrome } = calculateAvailablePulls(family, resources);

  if (family === BannerFamily.STABLE) {
    return {
      kind: "UNSUPPORTED_TARGET",
      reason:
        "Stable Channel не имеет механики featured-гарантии — игра не гарантирует конкретного персонажа или W-Engine, поэтому конкретная целевая копия не может быть посчитана как гарантированный худший сценарий.",
    };
  }

  const config = getBannerConfig(family);
  const { firstTargetCost, additionalTargetCost, totalRequiredPulls } =
    calculateTargetCopiesWorstCase(
      config,
      bannerState.sRankPity,
      bannerState.guaranteeActive,
      targetCopies,
    );

  const missingPulls = calculateMissingPulls(totalRequiredPulls, availablePulls);
  const missingPolychrome = calculateMissingPolychrome(family, missingPulls);

  const explanation: string[] = [
    `Гарантированный худший сценарий при hard pity ${config.hardPityS}.`,
    bannerState.guaranteeActive
      ? "Гарантия уже активна — она учтена только для первой копии."
      : "Гарантия не активна — учтён риск проигрыша ближайшего 50/50.",
  ];
  if (targetCopies > 1) {
    explanation.push(
      `Для копий 2–${targetCopies} pity и гарантия считаются заново, без переноса текущего состояния.`,
    );
  }

  return {
    firstTargetCost,
    additionalTargetCost,
    totalRequiredPulls,
    availablePulls,
    missingPulls,
    missingPolychrome,
    leftoverPolychrome,
    explanation,
  };
}
