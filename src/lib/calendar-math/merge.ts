import { compareLocalDate, formatLocalDate, type LocalDate } from "./local-date";
import type { VirtualOccurrence } from "./exceptions";
import type { BannerFamily } from "@/config/gacha";
import type { CurrencyType, IncomeSource, TransactionType } from "./types";

/**
 * A real, already-recorded CalendarTransaction row, in the shape merge.ts
 * needs. Carries every field the client-facing MergedOccurrenceDto needs
 * to let a user edit/delete a displayed one-time transaction (id, version)
 * or show its full detail (source, bannerFamily, note) — all of these
 * already exist on the underlying database row; this type must not strip
 * any of them, or a displayed "actual" occurrence becomes un-editable.
 */
export type ActualOccurrence = {
  id: string;
  /** Non-null only when this row materializes a series occurrence. */
  seriesId: string | null;
  /** The scheduled occurrence date this row materializes, if any. */
  occurrenceDate: LocalDate | null;
  /** The date it actually happened on (may differ from occurrenceDate for a backdated entry). */
  localDate: LocalDate;
  type: TransactionType;
  currencyType: CurrencyType | null;
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
  version: number;
};

// NOTE: the discriminant is named `kind`, not `source` — VirtualOccurrence
// already has its own unrelated `source` field (IncomeSource | null), so
// reusing that name for the actual/virtual tag would collide.
export type MergedOccurrence =
  | ({ kind: "actual" } & ActualOccurrence)
  | ({ kind: "virtual" } & VirtualOccurrence);

function occurrenceKey(seriesId: string, occurrenceDate: LocalDate): string {
  return `${seriesId}:${formatLocalDate(occurrenceDate)}`;
}

function dateOf(item: MergedOccurrence): LocalDate {
  return item.kind === "actual" ? item.localDate : item.occurrenceDate;
}

/**
 * Merges real (actual) transactions with virtual (forecasted) series
 * occurrences for display, deduplicating so a series occurrence that has
 * ALREADY been materialized into a real CalendarTransaction never shows
 * up twice — the actual row always wins over its virtual counterpart.
 *
 * Dedup key is (seriesId, occurrenceDate) — an actual row only suppresses
 * a virtual occurrence when both are set and match; a one-time actual
 * transaction (seriesId/occurrenceDate both null) never suppresses
 * anything and is always included as-is.
 */
export function mergeActualAndVirtual(
  actual: ActualOccurrence[],
  virtual: VirtualOccurrence[],
): MergedOccurrence[] {
  const materializedKeys = new Set(
    actual
      .filter(
        (a): a is ActualOccurrence & { seriesId: string; occurrenceDate: LocalDate } =>
          a.seriesId !== null && a.occurrenceDate !== null,
      )
      .map((a) => occurrenceKey(a.seriesId, a.occurrenceDate)),
  );

  const virtualFiltered = virtual.filter(
    (v) => !materializedKeys.has(occurrenceKey(v.seriesId, v.occurrenceDate)),
  );

  const merged: MergedOccurrence[] = [
    ...actual.map((a): MergedOccurrence => ({ kind: "actual", ...a })),
    ...virtualFiltered.map((v): MergedOccurrence => ({ kind: "virtual", ...v })),
  ];

  merged.sort((a, b) => compareLocalDate(dateOf(a), dateOf(b)));
  return merged;
}
