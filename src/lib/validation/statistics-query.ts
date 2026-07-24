import { z } from "zod";
import { compareLocalDate, toEpochDay } from "@/lib/calendar-math";
import { localDateSchema } from "./calendar-local-date";

/** Same bound as calendar-query.ts's occurrencesQuerySchema — a generous year, not unbounded. */
const MAX_STATISTICS_RANGE_DAYS = 366;

export const statisticsOverviewQuerySchema = z
  .object({
    from: localDateSchema,
    to: localDateSchema,
  })
  .strict()
  .refine((query) => compareLocalDate(query.from, query.to) <= 0, {
    message: "from must be <= to",
    path: ["from"],
  })
  .refine((query) => toEpochDay(query.to) - toEpochDay(query.from) <= MAX_STATISTICS_RANGE_DAYS, {
    message: `range must not exceed ${MAX_STATISTICS_RANGE_DAYS} days`,
    path: ["to"],
  });

export type StatisticsOverviewQuery = z.infer<typeof statisticsOverviewQuerySchema>;
