import { z } from "zod";
import { parseLocalDate } from "@/lib/calendar-math";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates and parses a "YYYY-MM-DD" string into a LocalDate using
 * calendar-math's own strict parser (integer arithmetic, no JS `Date`
 * object involved at any point) — this is the ONLY way calendar local
 * dates should ever enter the system from an API request.
 */
export const localDateSchema = z
  .string()
  .regex(ISO_DATE_PATTERN, "Ожидается дата в формате YYYY-MM-DD")
  .transform((value, ctx) => {
    try {
      return parseLocalDate(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректная календарная дата" });
      return z.NEVER;
    }
  });
