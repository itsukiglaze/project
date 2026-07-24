import { z } from "zod";
import { BannerFamily } from "@/config/gacha";

const MAX_SAFE_RESOURCE = 1_000_000_000;
const MAX_TARGET_COPIES = 50;

/**
 * Partial overrides for a single calculator run. Overrides are never
 * persisted anywhere — they exist only for the lifetime of this one
 * request (see gacha-calculator-service.ts).
 */
const resourceOverridesSchema = z
  .object({
    polychrome: z.number().int().min(0).max(MAX_SAFE_RESOURCE),
    monochrome: z.number().int().min(0).max(MAX_SAFE_RESOURCE),
    encryptedMasterTape: z.number().int().min(0).max(MAX_SAFE_RESOURCE),
    masterTape: z.number().int().min(0).max(MAX_SAFE_RESOURCE),
    boopon: z.number().int().min(0).max(MAX_SAFE_RESOURCE),
    includeMonochrome: z.boolean(),
  })
  .partial()
  .strict();

const bannerStateOverridesSchema = z
  .object({
    sRankPity: z.number().int().min(0),
    aRankPity: z.number().int().min(0),
    guaranteeActive: z.boolean(),
  })
  .partial()
  .strict();

/**
 * POST /api/calculator request body.
 *
 * Deliberately has NO userId/telegramId field — the user is always
 * resolved from the server-side session (see getCurrentUser()), never
 * from client input, so there is no field here to smuggle one through.
 */
export const calculatorRequestSchema = z
  .object({
    family: z.nativeEnum(BannerFamily),
    targetCopies: z.number().int().min(1).max(MAX_TARGET_COPIES),
    useSavedResources: z.boolean(),
    useSavedBannerState: z.boolean(),
    resourceOverrides: resourceOverridesSchema.optional(),
    bannerStateOverrides: bannerStateOverridesSchema.optional(),
  })
  .strict();

export type CalculatorRequest = z.infer<typeof calculatorRequestSchema>;
