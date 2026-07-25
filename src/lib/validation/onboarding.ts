import { z } from "zod";

export const updateOnboardingStatusRequestSchema = z
  .object({
    version: z.number().int().min(1),
    outcome: z.union([z.literal("COMPLETED"), z.literal("SKIPPED")]),
  })
  .strict();
export type UpdateOnboardingStatusRequest = z.infer<typeof updateOnboardingStatusRequestSchema>;
