// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrencyType } from "@/lib/calendar-math";
import { ComparisonRow } from "./comparison-row";
import type { CurrencyComparisonDto } from "./api";

describe("ComparisonRow", () => {
  it("shows a positive delta with an explicit '+' sign and a non-colour ▲ glyph", () => {
    const comparison: CurrencyComparisonDto = {
      currencyType: CurrencyType.POLYCHROME,
      current: 5420,
      previous: 5000,
      delta: 420,
      status: "positive",
    };
    render(<ComparisonRow comparison={comparison} />);
    expect(screen.getByText("5 420")).toBeInTheDocument();
    expect(screen.getByText("+420")).toBeInTheDocument();
    expect(screen.getByText("▲", { exact: false })).toBeInTheDocument();
  });

  it("shows a negative delta with an explicit '−' sign and a non-colour ▼ glyph", () => {
    const comparison: CurrencyComparisonDto = {
      currencyType: CurrencyType.POLYCHROME,
      current: 4840,
      previous: 5000,
      delta: -160,
      status: "negative",
    };
    render(<ComparisonRow comparison={comparison} />);
    expect(screen.getByText("−160")).toBeInTheDocument();
    expect(screen.getByText("▼", { exact: false })).toBeInTheDocument();
  });

  it("shows 'Без изменений' when unchanged", () => {
    const comparison: CurrencyComparisonDto = {
      currencyType: CurrencyType.MASTER_TAPE,
      current: 8,
      previous: 8,
      delta: 0,
      status: "unchanged",
    };
    render(<ComparisonRow comparison={comparison} />);
    expect(screen.getByText("Без изменений")).toBeInTheDocument();
  });

  it("shows 'Первое сохранение' when there is no previous snapshot at all", () => {
    const comparison: CurrencyComparisonDto = {
      currencyType: CurrencyType.POLYCHROME,
      current: 300,
      status: "no_previous_snapshot",
    };
    render(<ComparisonRow comparison={comparison} />);
    expect(screen.getByText("Первое сохранение")).toBeInTheDocument();
  });

  it("shows a distinct message when the previous snapshot didn't track this currency (never implies 0)", () => {
    const comparison: CurrencyComparisonDto = {
      currencyType: CurrencyType.BOOPON,
      current: 12,
      status: "previous_value_unavailable",
    };
    render(<ComparisonRow comparison={comparison} />);
    expect(screen.getByText("Раньше не отслеживалось")).toBeInTheDocument();
    expect(screen.queryByText(/\+12/)).not.toBeInTheDocument();
  });
});
