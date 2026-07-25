import { toEpochDay, type CurrencyType, type LocalDate } from "@/lib/calendar-math";
import type { SnapshotCurrencyAmount } from "./types";

export type CurrencyComparison =
  | { currencyType: CurrencyType; current: number; status: "no_previous_snapshot" }
  | { currencyType: CurrencyType; current: number; status: "previous_value_unavailable" }
  | {
      currencyType: CurrencyType;
      current: number;
      previous: number;
      delta: number;
      status: "positive" | "negative" | "unchanged";
    };

function compareCurrency(
  currencyType: CurrencyType,
  current: number,
  previousItems: readonly SnapshotCurrencyAmount[] | null,
): CurrencyComparison {
  if (previousItems === null) {
    return { currencyType, current, status: "no_previous_snapshot" };
  }
  const previousEntry = previousItems.find((item) => item.currencyType === currencyType);
  if (previousEntry === undefined) {
    return { currencyType, current, status: "previous_value_unavailable" };
  }
  const delta = current - previousEntry.amount;
  const status = delta > 0 ? "positive" : delta < 0 ? "negative" : "unchanged";
  return { currencyType, current, previous: previousEntry.amount, delta, status };
}

/**
 * Per-currency comparison of `currentItems` against `previousItems` — the
 * latest snapshot strictly before this one, or `null` if none exists at
 * all. Never combines different currencies into one total; never converts
 * between currencies; a currency simply absent from a real previous
 * snapshot is a distinct, distinguishable state
 * ("previous_value_unavailable"), never silently treated as a prior value
 * of 0. Pure and stateless — callers (resource-snapshot-service.ts) are
 * responsible for looking up the correct "previous" snapshot for whichever
 * date is being compared (not necessarily the global latest — see that
 * file for why an edit to an old snapshot must compare against ITS OWN
 * predecessor).
 */
export function compareSnapshotItems(
  currentItems: readonly SnapshotCurrencyAmount[],
  previousItems: readonly SnapshotCurrencyAmount[] | null,
): CurrencyComparison[] {
  return currentItems.map((item) => compareCurrency(item.currencyType, item.amount, previousItems));
}

/** Whole calendar days between two LocalDates (b - a); positive when b is after a. */
export function daysBetweenLocalDates(a: LocalDate, b: LocalDate): number {
  return toEpochDay(b) - toEpochDay(a);
}
