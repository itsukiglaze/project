import { z } from "zod";
import { BannerFamily } from "@/config/gacha";
import { CurrencyType, IncomeSource, RecurrenceEndType, RecurrenceFrequency, TransactionType } from "@/lib/calendar-math";
import { localDateSchema } from "./calendar-local-date";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;
export const idempotencyKeySchema = z
  .string()
  .regex(IDEMPOTENCY_KEY_PATTERN, "Некорректный формат idempotencyKey");
export const expectedVersionSchema = z.number().int().min(0);

/**
 * Shape-level validation only (types/ranges/no-duplicates). The
 * frequency-conditional cross-field rules (e.g. "daysOfWeek required for
 * WEEKLY") are re-checked by validateRecurrenceRule in lib/calendar-math —
 * deliberately not duplicated here, same separation used throughout the
 * calculator and Stage 4B save endpoints.
 */
export const recurrenceRuleSchema = z
  .object({
    frequency: z.nativeEnum(RecurrenceFrequency),
    interval: z.number().int().min(1),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7),
    dayOfMonth: z.number().int().min(1).max(31).nullable(),
    startDate: localDateSchema,
    endType: z.nativeEnum(RecurrenceEndType),
    endDate: localDateSchema.nullable(),
    occurrenceCount: z.number().int().min(1).nullable(),
  })
  .strict()
  .refine((rule) => new Set(rule.daysOfWeek).size === rule.daysOfWeek.length, {
    message: "daysOfWeek must not contain duplicates",
    path: ["daysOfWeek"],
  });

const MAX_NOTE_LENGTH = 500;
const MAX_SERIES_AMOUNT = 1_000_000_000;

/** Recurring series templates are INCOME/EXPENSE only — PULL is rejected at this layer, not just the service's. */
export const seriesTemplateSchema = z
  .object({
    type: z.union([z.literal(TransactionType.INCOME), z.literal(TransactionType.EXPENSE)]),
    currencyType: z.nativeEnum(CurrencyType).nullable(),
    amount: z.number().int().min(1).max(MAX_SERIES_AMOUNT),
    source: z.nativeEnum(IncomeSource).nullable(),
    bannerFamily: z.nativeEnum(BannerFamily).nullable(),
    note: z.string().max(MAX_NOTE_LENGTH).nullable(),
  })
  .strict();

export const createSeriesRequestSchema = seriesTemplateSchema
  .extend({
    rule: recurrenceRuleSchema,
    timezone: z.string().min(1).max(100),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export type CreateSeriesRequest = z.infer<typeof createSeriesRequestSchema>;

/** Timezone is frozen at creation — not accepted on update (see CalendarEventSeries.timezone). */
export const updateSeriesRequestSchema = seriesTemplateSchema
  .extend({
    rule: recurrenceRuleSchema,
    expectedVersion: expectedVersionSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export type UpdateSeriesRequest = z.infer<typeof updateSeriesRequestSchema>;

export const splitSeriesRequestSchema = seriesTemplateSchema
  .extend({
    rule: recurrenceRuleSchema,
    splitDate: localDateSchema,
    expectedVersion: expectedVersionSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export type SplitSeriesRequest = z.infer<typeof splitSeriesRequestSchema>;

export const deleteSeriesRequestSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export type DeleteSeriesRequest = z.infer<typeof deleteSeriesRequestSchema>;
