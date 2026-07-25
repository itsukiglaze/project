import { describe, expect, it } from "vitest";
import { mergeActualAndVirtual, type ActualOccurrence } from "./merge";
import type { VirtualOccurrence } from "./exceptions";
import type { LocalDate } from "./local-date";
import { CurrencyType, IncomeSource, TransactionType } from "./types";

function d(year: number, month: number, day: number): LocalDate {
  return { year, month, day };
}

function virtual(overrides: Partial<VirtualOccurrence> = {}): VirtualOccurrence {
  return {
    seriesId: "series-1",
    occurrenceDate: d(2026, 1, 1),
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 60,
    source: IncomeSource.DAILY,
    bannerFamily: null,
    note: null,
    ...overrides,
  };
}

function actual(overrides: Partial<ActualOccurrence> = {}): ActualOccurrence {
  return {
    id: "tx-1",
    seriesId: null,
    occurrenceDate: null,
    localDate: d(2026, 1, 1),
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 60,
    source: IncomeSource.DAILY,
    bannerFamily: null,
    note: null,
    version: 1,
    ...overrides,
  };
}

describe("mergeActualAndVirtual", () => {
  it("includes a one-time actual transaction as-is", () => {
    const result = mergeActualAndVirtual([actual()], []);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("actual");
  });

  it("preserves id/source/bannerFamily/note/version on an actual occurrence — required for a client to edit/delete it", () => {
    const result = mergeActualAndVirtual(
      [actual({ id: "tx-42", source: IncomeSource.EVENT, note: "bonus", version: 3 })],
      [],
    );
    expect(result[0]).toMatchObject({
      kind: "actual",
      id: "tx-42",
      source: IncomeSource.EVENT,
      note: "bonus",
      version: 3,
    });
  });

  it("includes a virtual occurrence when nothing materialized it yet", () => {
    const result = mergeActualAndVirtual([], [virtual()]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("virtual");
  });

  it("suppresses a virtual occurrence that has already been materialized (same series + occurrence date)", () => {
    const materialized = actual({ seriesId: "series-1", occurrenceDate: d(2026, 1, 1), localDate: d(2026, 1, 1) });
    const result = mergeActualAndVirtual([materialized], [virtual({ seriesId: "series-1", occurrenceDate: d(2026, 1, 1) })]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("actual");
  });

  it("does NOT suppress a virtual occurrence from a DIFFERENT series, even on the same date", () => {
    const materialized = actual({ seriesId: "series-1", occurrenceDate: d(2026, 1, 1), localDate: d(2026, 1, 1) });
    const result = mergeActualAndVirtual(
      [materialized],
      [virtual({ seriesId: "series-2", occurrenceDate: d(2026, 1, 1) })],
    );
    expect(result).toHaveLength(2);
  });

  it("does NOT suppress a virtual occurrence on a DIFFERENT date of the same series", () => {
    const materialized = actual({ seriesId: "series-1", occurrenceDate: d(2026, 1, 1), localDate: d(2026, 1, 1) });
    const result = mergeActualAndVirtual(
      [materialized],
      [virtual({ seriesId: "series-1", occurrenceDate: d(2026, 1, 2) })],
    );
    expect(result).toHaveLength(2);
  });

  it("a one-time actual transaction never suppresses anything (seriesId/occurrenceDate both null)", () => {
    const result = mergeActualAndVirtual([actual()], [virtual({ seriesId: "series-1", occurrenceDate: d(2026, 1, 1) })]);
    expect(result).toHaveLength(2);
  });

  it("sorts the merged result by date", () => {
    const result = mergeActualAndVirtual(
      [actual({ localDate: d(2026, 1, 10) })],
      [virtual({ occurrenceDate: d(2026, 1, 5) }), virtual({ occurrenceDate: d(2026, 1, 20), seriesId: "series-2" })],
    );
    const dates = result.map((r) => (r.kind === "actual" ? r.localDate : r.occurrenceDate));
    expect(dates).toEqual([d(2026, 1, 5), d(2026, 1, 10), d(2026, 1, 20)]);
  });

  it("handles empty inputs", () => {
    expect(mergeActualAndVirtual([], [])).toEqual([]);
  });
});
