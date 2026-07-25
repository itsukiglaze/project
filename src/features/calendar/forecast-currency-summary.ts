import { TransactionType, type CurrencyType } from "@/lib/calendar-math";
import type { MergedOccurrenceDto } from "./api";

export type CurrencyTotal = { currency: CurrencyType | null; total: number };

/**
 * Sums only INCOME occurrences (the "Ожидаемые поступления" figure) within
 * the forecast window, grouped by currency — deliberately never combined
 * across currencies, since amounts in different currencies aren't
 * additively comparable. Pure display aggregation over `ForecastDto.
 * occurrences`, the same data the API already returns; does not touch
 * `projectedEndingBalance` or any forecast math.
 */
export function summarizeIncomeByCurrency(occurrences: MergedOccurrenceDto[]): CurrencyTotal[] {
  const totals = new Map<CurrencyType | null, number>();
  for (const occurrence of occurrences) {
    if (occurrence.type !== TransactionType.INCOME) continue;
    totals.set(occurrence.currencyType, (totals.get(occurrence.currencyType) ?? 0) + occurrence.amount);
  }
  return Array.from(totals.entries()).map(([currency, total]) => ({ currency, total }));
}

/** Every distinct currency represented in the forecast window's occurrences. */
export function distinctCurrencies(occurrences: MergedOccurrenceDto[]): (CurrencyType | null)[] {
  return Array.from(new Set(occurrences.map((o) => o.currencyType)));
}
