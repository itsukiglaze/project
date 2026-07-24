import { z } from "zod";
import { BannerFamily } from "@/config/gacha";
import { CurrencyType, IncomeSource } from "@/lib/calendar-math";
import { expectedVersionSchema, idempotencyKeySchema } from "./calendar-series";

const MAX_NOTE_LENGTH = 500;
const MAX_AMOUNT = 1_000_000_000;

/**
 * MVP override scope matches CalendarEventException in
 * prisma/schema.prisma: amount/currency/source/bannerFamily/note only —
 * no `type` field here at all (route param + series own the direction).
 */
export const upsertExceptionRequestSchema = z
  .object({
    isCancelled: z.boolean(),
    amountOverride: z.number().int().min(1).max(MAX_AMOUNT).nullable(),
    currencyTypeOverride: z.nativeEnum(CurrencyType).nullable(),
    sourceOverride: z.nativeEnum(IncomeSource).nullable(),
    bannerFamilyOverride: z.nativeEnum(BannerFamily).nullable(),
    noteOverride: z.string().max(MAX_NOTE_LENGTH).nullable(),
    expectedVersion: expectedVersionSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export type UpsertExceptionRequest = z.infer<typeof upsertExceptionRequestSchema>;
