import { describe, expect, it } from "vitest";
import { CurrencyType } from "@/lib/calendar-math";
import { compareSnapshotItems, daysBetweenLocalDates } from "./comparison";

describe("compareSnapshotItems", () => {
  it("reports a positive delta when the current amount is higher", () => {
    const [result] = compareSnapshotItems(
      [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }],
      [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }],
    );
    expect(result).toEqual({
      currencyType: CurrencyType.POLYCHROME,
      current: 5420,
      previous: 5000,
      delta: 420,
      status: "positive",
    });
  });

  it("reports a negative delta when the current amount is lower", () => {
    const [result] = compareSnapshotItems(
      [{ currencyType: CurrencyType.POLYCHROME, amount: 4840 }],
      [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }],
    );
    expect(result).toMatchObject({ delta: -160, status: "negative" });
  });

  it("reports unchanged when the amount is identical", () => {
    const [result] = compareSnapshotItems(
      [{ currencyType: CurrencyType.MASTER_TAPE, amount: 8 }],
      [{ currencyType: CurrencyType.MASTER_TAPE, amount: 8 }],
    );
    expect(result).toMatchObject({ delta: 0, status: "unchanged" });
  });

  it("reports previous_value_unavailable when the prior snapshot lacks this currency — never treats it as 0", () => {
    const [result] = compareSnapshotItems(
      [{ currencyType: CurrencyType.BOOPON, amount: 12 }],
      [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }],
    );
    expect(result).toEqual({ currencyType: CurrencyType.BOOPON, current: 12, status: "previous_value_unavailable" });
  });

  it("reports no_previous_snapshot when there is no prior snapshot at all", () => {
    const [result] = compareSnapshotItems([{ currencyType: CurrencyType.POLYCHROME, amount: 300 }], null);
    expect(result).toEqual({ currencyType: CurrencyType.POLYCHROME, current: 300, status: "no_previous_snapshot" });
  });

  it("compares each currency independently, never merging amounts across currencies", () => {
    const results = compareSnapshotItems(
      [
        { currencyType: CurrencyType.POLYCHROME, amount: 5420 },
        { currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE, amount: 12 },
      ],
      [
        { currencyType: CurrencyType.POLYCHROME, amount: 5000 },
        { currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE, amount: 10 },
      ],
    );
    expect(results).toEqual([
      { currencyType: CurrencyType.POLYCHROME, current: 5420, previous: 5000, delta: 420, status: "positive" },
      {
        currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE,
        current: 12,
        previous: 10,
        delta: 2,
        status: "positive",
      },
    ]);
  });

  it("handles an empty current-items list", () => {
    expect(compareSnapshotItems([], [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }])).toEqual([]);
  });
});

describe("daysBetweenLocalDates", () => {
  it("returns 1 for consecutive days", () => {
    expect(daysBetweenLocalDates({ year: 2026, month: 7, day: 24 }, { year: 2026, month: 7, day: 25 })).toBe(1);
  });

  it("returns the correct gap for non-consecutive dates", () => {
    expect(daysBetweenLocalDates({ year: 2026, month: 7, day: 20 }, { year: 2026, month: 7, day: 25 })).toBe(5);
  });

  it("returns 0 for the same date", () => {
    expect(daysBetweenLocalDates({ year: 2026, month: 7, day: 25 }, { year: 2026, month: 7, day: 25 })).toBe(0);
  });

  it("returns a negative number when b is before a", () => {
    expect(daysBetweenLocalDates({ year: 2026, month: 7, day: 25 }, { year: 2026, month: 7, day: 20 })).toBe(-5);
  });

  it("handles a month boundary correctly", () => {
    expect(daysBetweenLocalDates({ year: 2026, month: 6, day: 30 }, { year: 2026, month: 7, day: 1 })).toBe(1);
  });
});
