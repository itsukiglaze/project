import { z } from "zod";
import { BannerFamily } from "@/config/gacha";
import { CurrencyType, IncomeSource, TransactionType } from "@/lib/calendar-math";
import { localDateSchema } from "./calendar-local-date";
import { expectedVersionSchema, idempotencyKeySchema } from "./calendar-series";

const MAX_NOTE_LENGTH = 500;
const MAX_AMOUNT = 1_000_000_000;

/** One-time transactions allow all three TransactionType values, unlike recurring series (INCOME/EXPENSE only). */
export const createTransactionRequestSchema = z
  .object({
    localDate: localDateSchema,
    type: z.nativeEnum(TransactionType),
    currencyType: z.nativeEnum(CurrencyType).nullable(),
    amount: z.number().int().min(1).max(MAX_AMOUNT),
    source: z.nativeEnum(IncomeSource).nullable(),
    bannerFamily: z.nativeEnum(BannerFamily).nullable(),
    note: z.string().max(MAX_NOTE_LENGTH).nullable(),
    timezone: z.string().min(1).max(100),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export type CreateTransactionRequest = z.infer<typeof createTransactionRequestSchema>;

export const updateTransactionRequestSchema = createTransactionRequestSchema
  .omit({ idempotencyKey: true })
  .extend({
    expectedVersion: expectedVersionSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export type UpdateTransactionRequest = z.infer<typeof updateTransactionRequestSchema>;

export const deleteTransactionRequestSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export type DeleteTransactionRequest = z.infer<typeof deleteTransactionRequestSchema>;
