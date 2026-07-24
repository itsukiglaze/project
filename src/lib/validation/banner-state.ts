import { z } from "zod";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;

/**
 * Shape-level validation only (non-negative integers, boolean). The actual
 * domain bound (0 <= pity < hardPity for the specific family) depends on
 * config/gacha.ts and is re-checked by `validateBannerStateInput` from
 * lib/gacha-math — deliberately not duplicated here.
 *
 * There is no `family` field here on purpose — the route parameter is the
 * ONLY source of truth for which family is being written, so there is no
 * body value that could ever disagree with it.
 *
 * `idempotencyKey` is required; `expectedVersion` implements optimistic
 * concurrency (see saveBannerState).
 */
export const saveBannerStateRequestSchema = z
  .object({
    sRankPity: z.number().int().min(0),
    aRankPity: z.number().int().min(0),
    guaranteeActive: z.boolean(),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().regex(IDEMPOTENCY_KEY_PATTERN, "Некорректный формат idempotencyKey"),
  })
  .strict();

export type SaveBannerStateRequest = z.infer<typeof saveBannerStateRequestSchema>;
