import { z } from "zod";
import { compareLocalDate, toEpochDay } from "@/lib/calendar-math";
import { localDateSchema } from "./calendar-local-date";

/** Safe upper bound on a requested occurrence view window — a generous year, not unbounded. */
const MAX_OCCURRENCE_RANGE_DAYS = 366;

export const occurrencesQuerySchema = z
  .object({
    from: localDateSchema,
    to: localDateSchema,
  })
  .strict()
  .refine((query) => compareLocalDate(query.from, query.to) <= 0, {
    message: "from must be <= to",
    path: ["from"],
  })
  .refine((query) => toEpochDay(query.to) - toEpochDay(query.from) <= MAX_OCCURRENCE_RANGE_DAYS, {
    message: `range must not exceed ${MAX_OCCURRENCE_RANGE_DAYS} days`,
    path: ["to"],
  });
export type OccurrencesQuery = z.infer<typeof occurrencesQuerySchema>;

/**
 * Shape-level sanity bound only — the actual authoritative horizon cap
 * (MAX_FORECAST_HORIZON_DAYS = 90) is enforced by
 * calculateBoundedForecast in lib/calendar-math, not duplicated here. This
 * just rejects nonsensical input (negative, absurdly large) early.
 */
const MAX_REQUESTABLE_HORIZON_DAYS = 3650;

export const forecastQuerySchema = z
  .object({
    days: z.coerce.number().int().min(0).max(MAX_REQUESTABLE_HORIZON_DAYS),
  })
  .strict();
export type ForecastQuery = z.infer<typeof forecastQuerySchema>;
