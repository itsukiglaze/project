import { BannerFamily, PullCurrency, type BannerConfig } from "@/config/gacha";
import {
  parseNonNegativeInt,
  parsePity,
  parseTargetCopies,
  toValidatedSafeInt,
} from "./field-validation";
import type { CalculatorRequestPayload } from "./api";
import type { FamilyFormState } from "./types";

/** Field-keyed error messages for the currently-relevant inputs only. */
export function getClientFieldErrors(
  family: BannerFamily,
  state: FamilyFormState,
  config: BannerConfig,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!state.useSavedBannerState) {
    const sRank = parsePity(state.bannerState.sRankPity, config.hardPityS);
    if (!sRank.ok) errors.sRankPity = sRank.error;

    const aRank = parsePity(state.bannerState.aRankPity, config.hardPityA);
    if (!aRank.ok) errors.aRankPity = aRank.error;
  }

  if (!state.useSavedResources) {
    if (config.currency === PullCurrency.BOOPON) {
      const boopon = parseNonNegativeInt(state.resources.boopon);
      if (!boopon.ok) errors.boopon = boopon.error;
    } else {
      const polychrome = parseNonNegativeInt(state.resources.polychrome);
      if (!polychrome.ok) errors.polychrome = polychrome.error;

      const monochrome = parseNonNegativeInt(state.resources.monochrome);
      if (!monochrome.ok) errors.monochrome = monochrome.error;

      if (config.currency === PullCurrency.ENCRYPTED_MASTER_TAPE) {
        const tape = parseNonNegativeInt(state.resources.encryptedMasterTape);
        if (!tape.ok) errors.encryptedMasterTape = tape.error;
      } else {
        const tape = parseNonNegativeInt(state.resources.masterTape);
        if (!tape.ok) errors.masterTape = tape.error;
      }
    }
  }

  // Stable has no user-facing "target copies" input — 1 is sent as a
  // technical placeholder the API/UI both know to ignore (UNSUPPORTED_TARGET).
  if (family !== BannerFamily.STABLE) {
    const copies = parseTargetCopies(state.targetCopies);
    if (!copies.ok) errors.targetCopies = copies.error;
  }

  return errors;
}

export function hasClientFieldErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Builds the exact request body for POST /api/calculator.
 *
 * Only called after `getClientFieldErrors` returns no errors, so the
 * `Number(...)` conversions below are safe. Only ever includes override
 * fields that are actually relevant to `family` and to whichever
 * saved/temporary mode is active — never sends e.g. `masterTape` for
 * Exclusive Agent, or `boopon` for anything but Bangboo.
 */
export function buildCalculatorRequestPayload(
  family: BannerFamily,
  state: FamilyFormState,
  config: BannerConfig,
): CalculatorRequestPayload {
  const payload: CalculatorRequestPayload = {
    family,
    targetCopies:
      family === BannerFamily.STABLE ? 1 : toValidatedSafeInt(state.targetCopies, "targetCopies"),
    useSavedResources: state.useSavedResources,
    useSavedBannerState: state.useSavedBannerState,
  };

  if (!state.useSavedBannerState) {
    payload.bannerStateOverrides = {
      sRankPity: toValidatedSafeInt(state.bannerState.sRankPity, "sRankPity"),
      aRankPity: toValidatedSafeInt(state.bannerState.aRankPity, "aRankPity"),
      // The guarantee toggle is only meaningful (and only shown) for
      // Exclusive Agent / W-Engine — Bangboo's selected target is always
      // guaranteed regardless, and Stable has no featured guarantee at all.
      ...(!config.selectedTargetAlways && family !== BannerFamily.STABLE
        ? { guaranteeActive: state.bannerState.guaranteeActive }
        : {}),
    };
  }

  if (!state.useSavedResources) {
    if (config.currency === PullCurrency.BOOPON) {
      payload.resourceOverrides = { boopon: toValidatedSafeInt(state.resources.boopon, "boopon") };
    } else {
      payload.resourceOverrides = {
        polychrome: toValidatedSafeInt(state.resources.polychrome, "polychrome"),
        monochrome: toValidatedSafeInt(state.resources.monochrome, "monochrome"),
        includeMonochrome: state.resources.includeMonochrome,
        ...(config.currency === PullCurrency.ENCRYPTED_MASTER_TAPE
          ? {
              encryptedMasterTape: toValidatedSafeInt(
                state.resources.encryptedMasterTape,
                "encryptedMasterTape",
              ),
            }
          : { masterTape: toValidatedSafeInt(state.resources.masterTape, "masterTape") }),
      };
    }
  }

  return payload;
}

/** A stable string fingerprint of "what the result would depend on", used to detect staleness. */
export function computeRequestSignature(
  family: BannerFamily,
  state: FamilyFormState,
): string {
  return JSON.stringify({ family, ...state });
}
