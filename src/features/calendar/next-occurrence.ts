import {
  addDays,
  expandRecurrence,
  parseLocalDate,
  type LocalDate,
  type RecurrenceRule,
} from "@/lib/calendar-math";
import type { RecurrenceRuleDto } from "./api";

const NEXT_OCCURRENCE_HORIZON_DAYS = 90;

function ruleDtoToDomain(dto: RecurrenceRuleDto): RecurrenceRule {
  return {
    frequency: dto.frequency,
    interval: dto.interval,
    daysOfWeek: dto.daysOfWeek,
    dayOfMonth: dto.dayOfMonth,
    startDate: parseLocalDate(dto.startDate),
    endType: dto.endType,
    endDate: dto.endDate ? parseLocalDate(dto.endDate) : null,
    occurrenceCount: dto.occurrenceCount,
  };
}

/**
 * The next date this series is due on or after `from` — a display-only
 * summary for the "Регулярные источники" list, reusing the exact same
 * `expandRecurrence` the server's forecast already calls (see
 * lib/calendar-math/forecast.ts), not a reimplementation of it. Ignores
 * this series' own exceptions (cancellations/overrides), which aren't
 * loaded in the series-list view, so a date landing on a cancelled or
 * overridden occurrence may be slightly off — fine for a summary label,
 * not something this value is ever used to calculate against.
 */
export function getNextOccurrenceDate(rule: RecurrenceRuleDto, from: LocalDate): LocalDate | null {
  const domainRule = ruleDtoToDomain(rule);
  const rangeEnd = addDays(from, NEXT_OCCURRENCE_HORIZON_DAYS);
  const dates = expandRecurrence(domainRule, from, rangeEnd);
  return dates.length > 0 ? dates[0] : null;
}
