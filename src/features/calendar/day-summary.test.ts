import { describe, expect, it } from "vitest";
import { getDaySummary, summarizeOccurrencesByDay } from "./day-summary";
import type { MergedOccurrenceDto } from "./api";
import { CurrencyType, IncomeSource, TransactionType } from "@/lib/calendar-math";

function actual(
  overrides: Partial<Extract<MergedOccurrenceDto, { kind: "actual" }>> = {},
): MergedOccurrenceDto {
  return {
    kind: "actual",
    id: "tx-1",
    localDate: "2026-01-05",
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 300,
    source: IncomeSource.EVENT,
    bannerFamily: null,
    note: null,
    seriesId: null,
    occurrenceDate: null,
    version: 1,
    ...overrides,
  };
}

function virtual(
  overrides: Partial<Extract<MergedOccurrenceDto, { kind: "virtual" }>> = {},
): MergedOccurrenceDto {
  return {
    kind: "virtual",
    seriesId: "series-1",
    occurrenceDate: "2026-01-05",
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 60,
    source: IncomeSource.DAILY,
    bannerFamily: null,
    note: null,
    ...overrides,
  };
}

describe("summarizeOccurrencesByDay / getDaySummary", () => {
  it("marks a day with only an actual occurrence as hasActual and not hasVirtual", () => {
    const summaries = summarizeOccurrencesByDay([actual()]);
    const summary = getDaySummary(summaries, { year: 2026, month: 1, day: 5 });
    expect(summary?.hasActual).toBe(true);
    expect(summary?.hasVirtual).toBe(false);
  });

  it("marks a day with only a virtual occurrence as hasVirtual and not hasActual", () => {
    const summaries = summarizeOccurrencesByDay([virtual()]);
    const summary = getDaySummary(summaries, { year: 2026, month: 1, day: 5 });
    expect(summary?.hasVirtual).toBe(true);
    expect(summary?.hasActual).toBe(false);
  });

  it("marks a day with both as having both flags true", () => {
    const summaries = summarizeOccurrencesByDay([actual(), virtual()]);
    const summary = getDaySummary(summaries, { year: 2026, month: 1, day: 5 });
    expect(summary?.hasActual).toBe(true);
    expect(summary?.hasVirtual).toBe(true);
  });

  it("computes net as income minus expense (EXPENSE subtracts)", () => {
    const summaries = summarizeOccurrencesByDay([
      actual({ type: TransactionType.INCOME, amount: 300 }),
      actual({ id: "tx-2", type: TransactionType.EXPENSE, amount: 100 }),
    ]);
    const summary = getDaySummary(summaries, { year: 2026, month: 1, day: 5 });
    expect(summary).toEqual({ income: 300, expense: 100, net: 200, hasActual: true, hasVirtual: false });
  });

  it("returns null for a day with no occurrences", () => {
    const summaries = summarizeOccurrencesByDay([]);
    expect(getDaySummary(summaries, { year: 2026, month: 1, day: 5 })).toBeNull();
  });

  it("groups occurrences by their own date field (actual uses localDate, virtual uses occurrenceDate)", () => {
    const summaries = summarizeOccurrencesByDay([
      actual({ localDate: "2026-01-05" }),
      virtual({ occurrenceDate: "2026-01-06" }),
    ]);
    expect(getDaySummary(summaries, { year: 2026, month: 1, day: 5 })?.hasActual).toBe(true);
    expect(getDaySummary(summaries, { year: 2026, month: 1, day: 6 })?.hasVirtual).toBe(true);
  });
});
