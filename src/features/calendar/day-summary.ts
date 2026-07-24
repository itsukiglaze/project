import { formatLocalDate, type LocalDate } from "@/lib/calendar-math";
import type { MergedOccurrenceDto } from "./api";

export type DaySummary = {
  income: number;
  expense: number;
  net: number;
  hasActual: boolean;
  hasVirtual: boolean;
};

function dateOf(occurrence: MergedOccurrenceDto): string {
  return occurrence.kind === "actual" ? occurrence.localDate : occurrence.occurrenceDate;
}

/** INCOME adds, EXPENSE/PULL both subtract — same convention as calendar-math's balance.ts. */
function signedAmount(occurrence: MergedOccurrenceDto): number {
  return occurrence.type === "INCOME" ? occurrence.amount : -occurrence.amount;
}

/**
 * Groups a flat list of merged occurrences by calendar day, producing a
 * lookup from "YYYY-MM-DD" to that day's income/expense/net totals plus
 * whether it contains actual and/or virtual (forecast) occurrences —
 * everything a calendar cell needs to render its indicators.
 */
export function summarizeOccurrencesByDay(
  occurrences: MergedOccurrenceDto[],
): Map<string, DaySummary> {
  const byDay = new Map<string, DaySummary>();

  for (const occurrence of occurrences) {
    const key = dateOf(occurrence);
    const existing = byDay.get(key) ?? {
      income: 0,
      expense: 0,
      net: 0,
      hasActual: false,
      hasVirtual: false,
    };

    const signed = signedAmount(occurrence);
    if (occurrence.type === "INCOME") {
      existing.income += occurrence.amount;
    } else {
      existing.expense += occurrence.amount;
    }
    existing.net += signed;
    if (occurrence.kind === "actual") existing.hasActual = true;
    if (occurrence.kind === "virtual") existing.hasVirtual = true;

    byDay.set(key, existing);
  }

  return byDay;
}

export function getDaySummary(summaries: Map<string, DaySummary>, date: LocalDate): DaySummary | null {
  return summaries.get(formatLocalDate(date)) ?? null;
}
