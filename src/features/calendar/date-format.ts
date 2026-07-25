import type { LocalDate } from "@/lib/calendar-math";
import { MONTH_LABELS_GENITIVE } from "./labels";

/**
 * "25 июля" (or "25 июля 2026" with `includeYear`) — a plain-Russian date
 * for user-facing headings/copy. Never used for API/wire serialization —
 * that's `formatLocalDate`'s "YYYY-MM-DD" job (see lib/calendar-math), which
 * this does not replace or alter.
 */
export function formatHumanDate(date: LocalDate, includeYear = false): string {
  const month = MONTH_LABELS_GENITIVE[date.month - 1];
  return includeYear ? `${date.day} ${month} ${date.year}` : `${date.day} ${month}`;
}
