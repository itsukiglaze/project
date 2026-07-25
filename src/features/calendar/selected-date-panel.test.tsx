// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurrencyType, IncomeSource, TransactionType } from "@/lib/calendar-math";
import { SelectedDatePanel } from "./selected-date-panel";
import type { MergedOccurrenceDto } from "./api";

const DATE = { year: 2026, month: 7, day: 25 };

function actual(overrides: Partial<Extract<MergedOccurrenceDto, { kind: "actual" }>> = {}): MergedOccurrenceDto {
  return {
    kind: "actual",
    id: "tx-1",
    localDate: "2026-07-25",
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

describe("SelectedDatePanel", () => {
  it("renders nothing when no date is selected", () => {
    const { container } = render(
      <SelectedDatePanel date={null} hasAnySource occurrences={[]} onOpenDetails={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the date in plain-Russian format ('25 июля'), not the ISO wire format", () => {
    render(<SelectedDatePanel date={DATE} hasAnySource occurrences={[]} onOpenDetails={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "25 июля" })).toBeInTheDocument();
    expect(screen.queryByText("2026-07-25")).not.toBeInTheDocument();
  });

  it("shows the empty-date message when sources exist but nothing is expected that day", () => {
    render(<SelectedDatePanel date={DATE} hasAnySource occurrences={[]} onOpenDetails={vi.fn()} />);
    expect(screen.getByText("На эту дату поступлений нет.")).toBeInTheDocument();
  });

  it("shows the add-a-source hint instead when there are no sources at all", () => {
    render(<SelectedDatePanel date={DATE} hasAnySource={false} occurrences={[]} onOpenDetails={vi.fn()} />);
    expect(
      screen.getByText("Добавьте источник, чтобы увидеть будущие поступления на календаре."),
    ).toBeInTheDocument();
  });

  it("lists occurrences expected on the selected date with amount and currency", () => {
    render(
      <SelectedDatePanel date={DATE} hasAnySource occurrences={[actual({ amount: 300 })]} onOpenDetails={vi.fn()} />,
    );
    expect(screen.getByText(/Доход/)).toBeInTheDocument();
    expect(screen.getByText("300 Полихромы")).toBeInTheDocument();
  });

  it("opening details calls the provided handler", async () => {
    const onOpenDetails = vi.fn();
    render(<SelectedDatePanel date={DATE} hasAnySource occurrences={[]} onOpenDetails={onOpenDetails} />);
    await userEvent.click(screen.getByRole("button", { name: /подробнее и добавить операцию/i }));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });
});
