// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock("./use-transaction-mutations", () => ({
  useTransactionMutations: () => ({
    state: { status: "idle" },
    create: mockCreate,
    update: mockUpdate,
    remove: mockRemove,
    resetState: vi.fn(),
  }),
}));

import { DayDetailSheet } from "./day-detail-sheet";
import type { MergedOccurrenceDto } from "./api";
import { CurrencyType, IncomeSource, TransactionType } from "@/lib/calendar-math";

const DATE = { year: 2026, month: 1, day: 5 };

const ACTUAL_ONE_TIME: MergedOccurrenceDto = {
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
};

const ACTUAL_MATERIALIZED: MergedOccurrenceDto = {
  ...ACTUAL_ONE_TIME,
  id: "tx-2",
  seriesId: "series-1",
  occurrenceDate: "2026-01-05",
};

const VIRTUAL_OCCURRENCE: MergedOccurrenceDto = {
  kind: "virtual",
  seriesId: "series-1",
  occurrenceDate: "2026-01-05",
  type: TransactionType.INCOME,
  currencyType: CurrencyType.POLYCHROME,
  amount: 60,
  source: IncomeSource.DAILY,
  bannerFamily: null,
  note: null,
};

describe("DayDetailSheet", () => {
  it("renders as an accessible dialog labeled with the date", () => {
    render(
      <DayDetailSheet
        date={DATE}
        timezone="UTC"
        occurrences={[]}
        onClose={vi.fn()}
        onEditSeriesOccurrence={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: /2026-01-05/ })).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <DayDetailSheet date={DATE} timezone="UTC" occurrences={[]} onClose={onClose} onEditSeriesOccurrence={vi.fn()} />,
    );
    await userEvent.click(screen.getByLabelText(/закрыть/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when there are no occurrences", () => {
    render(
      <DayDetailSheet date={DATE} timezone="UTC" occurrences={[]} onClose={vi.fn()} onEditSeriesOccurrence={vi.fn()} />,
    );
    expect(screen.getByText(/на эту дату поступлений нет/i)).toBeInTheDocument();
  });

  it("lists actual one-time transactions with edit/delete controls", () => {
    render(
      <DayDetailSheet
        date={DATE}
        timezone="UTC"
        occurrences={[ACTUAL_ONE_TIME]}
        onClose={vi.fn()}
        onEditSeriesOccurrence={vi.fn()}
      />,
    );
    expect(screen.getByText(/фактические операции/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /изменить/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /удалить/i })).toBeInTheDocument();
  });

  it("does NOT show edit/delete controls for a materialized (series-linked) actual row", () => {
    render(
      <DayDetailSheet
        date={DATE}
        timezone="UTC"
        occurrences={[ACTUAL_MATERIALIZED]}
        onClose={vi.fn()}
        onEditSeriesOccurrence={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /^изменить$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^удалить$/i })).not.toBeInTheDocument();
  });

  it("lists virtual (forecast) occurrences with 'изменить'/'отменить' actions, labeled as an estimate", () => {
    render(
      <DayDetailSheet
        date={DATE}
        timezone="UTC"
        occurrences={[VIRTUAL_OCCURRENCE]}
        onClose={vi.fn()}
        onEditSeriesOccurrence={vi.fn()}
      />,
    );
    expect(screen.getByText(/оценка, не факт/i)).toBeInTheDocument();
  });

  it("delegates 'изменить' on a virtual occurrence to onEditSeriesOccurrence with action 'edit'", async () => {
    const onEditSeriesOccurrence = vi.fn();
    render(
      <DayDetailSheet
        date={DATE}
        timezone="UTC"
        occurrences={[VIRTUAL_OCCURRENCE]}
        onClose={vi.fn()}
        onEditSeriesOccurrence={onEditSeriesOccurrence}
      />,
    );
    const section = screen.getByLabelText(/прогнозные вхождения серии/i);
    await userEvent.click(within(section).getByRole("button", { name: /изменить/i }));
    expect(onEditSeriesOccurrence).toHaveBeenCalledWith(VIRTUAL_OCCURRENCE, "edit");
  });

  it("delegates 'отменить' on a virtual occurrence to onEditSeriesOccurrence with action 'cancel'", async () => {
    const onEditSeriesOccurrence = vi.fn();
    render(
      <DayDetailSheet
        date={DATE}
        timezone="UTC"
        occurrences={[VIRTUAL_OCCURRENCE]}
        onClose={vi.fn()}
        onEditSeriesOccurrence={onEditSeriesOccurrence}
      />,
    );
    const section = screen.getByLabelText(/прогнозные вхождения серии/i);
    await userEvent.click(within(section).getByRole("button", { name: /отменить/i }));
    expect(onEditSeriesOccurrence).toHaveBeenCalledWith(VIRTUAL_OCCURRENCE, "cancel");
  });

  it("opens the create-transaction form when 'Добавить операцию' is clicked", async () => {
    render(
      <DayDetailSheet date={DATE} timezone="UTC" occurrences={[]} onClose={vi.fn()} onEditSeriesOccurrence={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /добавить операцию/i }));
    expect(screen.getByRole("radiogroup", { name: /тип операции/i })).toBeInTheDocument();
  });

  it("requires confirmation before deleting a one-time transaction", async () => {
    render(
      <DayDetailSheet
        date={DATE}
        timezone="UTC"
        occurrences={[ACTUAL_ONE_TIME]}
        onClose={vi.fn()}
        onEditSeriesOccurrence={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /удалить/i }));
    expect(screen.getByRole("dialog", { name: /удалить операцию/i })).toBeInTheDocument();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("calls remove() only after confirming the delete dialog", async () => {
    mockRemove.mockResolvedValue({ id: "tx-1" });
    render(
      <DayDetailSheet
        date={DATE}
        timezone="UTC"
        occurrences={[ACTUAL_ONE_TIME]}
        onClose={vi.fn()}
        onEditSeriesOccurrence={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /удалить/i }));
    const confirmDialog = screen.getByRole("dialog", { name: /удалить операцию/i });
    await userEvent.click(within(confirmDialog).getByRole("button", { name: /^удалить$/i }));
    expect(mockRemove).toHaveBeenCalledWith("tx-1", 1);
  });
});
