import { BannerFamily } from "@/config/gacha";

export type { BannerFamily };

export type BannerStateInput = {
  family: BannerFamily;
  /** Pulls made since the last S-rank on this family. */
  sRankPity: number;
  /** Pulls made since the last A-rank (or higher) on this family. */
  aRankPity: number;
  guaranteeActive: boolean;
};

export type ResourceInput = {
  polychrome: number;
  monochrome: number;
  encryptedMasterTape: number;
  masterTape: number;
  boopon: number;
  /** User's own choice: fold monochrome into polychrome at a 1:1 rate. */
  includeMonochrome: boolean;
};

export type PullGoalInput = {
  family: BannerFamily;
  targetCopies: number;
};

export type GuaranteedCalculationResult = {
  /** Worst-case pulls needed for the first copy, or null if not computable. */
  firstTargetCost: number | null;
  /** Worst-case pulls needed for EACH additional copy beyond the first. */
  additionalTargetCost: number | null;
  /** Worst-case pulls needed for the whole goal (all requested copies). */
  totalRequiredPulls: number | null;
  availablePulls: number;
  /** max(0, totalRequiredPulls - availablePulls). */
  missingPulls: number;
  /** Polychrome needed to cover missingPulls, or null if not applicable (e.g. Bangboo). */
  missingPolychrome: number | null;
  leftoverPolychrome: number;
  /** Plain-language notes on which assumptions were used (worst case, hard pity, etc). */
  explanation: string[];
};

/**
 * Returned instead of a fabricated number whenever a request asks for
 * something the game does not actually guarantee — most importantly, a
 * specific character/W-Engine on the Stable channel, which has no
 * featured-item guarantee at all.
 */
export type UnsupportedGuaranteedTarget = {
  kind: "UNSUPPORTED_TARGET";
  reason: string;
};

export type GuaranteedTargetResult = GuaranteedCalculationResult | UnsupportedGuaranteedTarget;

export function isUnsupportedTarget(
  result: GuaranteedTargetResult,
): result is UnsupportedGuaranteedTarget {
  return "kind" in result && result.kind === "UNSUPPORTED_TARGET";
}

// ---------------------------------------------------------------------------
// Validation — typed results, no exceptions, no Zod (Zod lives at the
// API/UI boundary in src/lib/validation/*, not here).
// ---------------------------------------------------------------------------

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function isSafeNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

export function isValidPity(value: unknown, hardPity: number): value is number {
  // sRankPity/aRankPity represent "pulls since the last S/A-rank", so a
  // value equal to hardPity would mean an S-rank was already guaranteed
  // but not yet claimed — that state cannot exist as stored pity.
  return isSafeNonNegativeInteger(value) && value < hardPity;
}

export function validateBannerStateInput(
  input: BannerStateInput,
  hardPityS: number,
  hardPityA: number,
): ValidationResult<BannerStateInput> {
  const errors: string[] = [];

  if (!isValidPity(input.sRankPity, hardPityS)) {
    errors.push(
      `sRankPity must be an integer in [0, ${hardPityS - 1}], got ${String(input.sRankPity)}`,
    );
  }
  if (!isValidPity(input.aRankPity, hardPityA)) {
    errors.push(
      `aRankPity must be an integer in [0, ${hardPityA - 1}], got ${String(input.aRankPity)}`,
    );
  }
  if (typeof input.guaranteeActive !== "boolean") {
    errors.push("guaranteeActive must be a boolean");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: input };
}

export function validateResourceInput(input: ResourceInput): ValidationResult<ResourceInput> {
  const errors: string[] = [];
  const fields: Array<[keyof ResourceInput, number]> = [
    ["polychrome", input.polychrome],
    ["monochrome", input.monochrome],
    ["encryptedMasterTape", input.encryptedMasterTape],
    ["masterTape", input.masterTape],
    ["boopon", input.boopon],
  ];

  for (const [name, value] of fields) {
    if (!isSafeNonNegativeInteger(value)) {
      errors.push(`${name} must be a non-negative safe integer, got ${String(value)}`);
    }
  }
  if (typeof input.includeMonochrome !== "boolean") {
    errors.push("includeMonochrome must be a boolean");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: input };
}

export function validatePullGoalInput(input: PullGoalInput): ValidationResult<PullGoalInput> {
  const errors: string[] = [];
  if (
    typeof input.targetCopies !== "number" ||
    !Number.isInteger(input.targetCopies) ||
    !Number.isSafeInteger(input.targetCopies) ||
    input.targetCopies < 1
  ) {
    errors.push(`targetCopies must be an integer >= 1, got ${String(input.targetCopies)}`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: input };
}
