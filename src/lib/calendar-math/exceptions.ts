import type { BannerFamily } from "@/config/gacha";
import { formatLocalDate, type LocalDate } from "./local-date";
import type { SeriesTemplate } from "./transaction-validation";
import type { CurrencyType, IncomeSource } from "./types";

export type SeriesException = {
  occurrenceDate: LocalDate;
  isCancelled: boolean;
  /**
   * MVP override scope — matches CalendarEventException in
   * prisma/schema.prisma. `type` is deliberately not overridable per
   * occurrence (see schema comment); cancel + add a one-time transaction
   * instead if a genuinely different direction is needed for one date.
   */
  amountOverride: number | null;
  currencyTypeOverride: CurrencyType | null;
  sourceOverride: IncomeSource | null;
  bannerFamilyOverride: BannerFamily | null;
  noteOverride: string | null;
};

export type VirtualOccurrence = {
  seriesId: string;
  occurrenceDate: LocalDate;
  type: SeriesTemplate["type"];
  currencyType: CurrencyType | null;
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
};

/**
 * Applies exceptions (by scheduled occurrence date) to a series' raw
 * expanded occurrence dates, producing the effective virtual occurrences:
 * cancelled dates are dropped entirely, overridden fields replace the
 * template's own value, everything else falls back to the template.
 */
export function applyExceptions(
  seriesId: string,
  template: SeriesTemplate,
  occurrenceDates: LocalDate[],
  exceptions: SeriesException[],
): VirtualOccurrence[] {
  const exceptionByDate = new Map(exceptions.map((e) => [formatLocalDate(e.occurrenceDate), e]));

  const result: VirtualOccurrence[] = [];
  for (const date of occurrenceDates) {
    const exception = exceptionByDate.get(formatLocalDate(date));
    if (exception?.isCancelled) continue;

    result.push({
      seriesId,
      occurrenceDate: date,
      type: template.type,
      currencyType: exception?.currencyTypeOverride ?? template.currencyType,
      amount: exception?.amountOverride ?? template.amount,
      source: exception?.sourceOverride ?? template.source,
      bannerFamily: exception?.bannerFamilyOverride ?? template.bannerFamily,
      note: exception?.noteOverride ?? template.note,
    });
  }
  return result;
}
