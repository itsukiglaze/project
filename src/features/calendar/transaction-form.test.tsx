// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionForm, type EditableTransaction } from "./transaction-form";
import { CurrencyType, IncomeSource, TransactionType } from "@/lib/calendar-math";

const DATE = { year: 2026, month: 1, day: 5 };

describe("TransactionForm", () => {
  it("blocks editing a materialized (series-linked) transaction with an explanatory message, not a form", () => {
    const materialized: EditableTransaction = {
      id: "tx-1",
      localDate: "2026-01-05",
      type: TransactionType.INCOME,
      currencyType: CurrencyType.POLYCHROME,
      amount: 60,
      source: IncomeSource.DAILY,
      bannerFamily: null,
      note: null,
      seriesId: "series-1",
      occurrenceDate: "2026-01-05",
      version: 1,
    };
    render(
      <TransactionForm
        date={DATE}
        timezone="UTC"
        existing={materialized}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitting={false}
      />,
    );
    expect(screen.getByText(/создана из повторяющейся серии/i)).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("renders a full editable form for a one-time (non-materialized) transaction", () => {
    render(<TransactionForm date={DATE} timezone="UTC" onSubmit={vi.fn()} onCancel={vi.fn()} submitting={false} />);
    expect(screen.getByRole("radiogroup", { name: /тип операции/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/количество/i)).toBeInTheDocument();
  });

  it("submits with the correct payload for a valid amount", async () => {
    const onSubmit = vi.fn();
    render(
      <TransactionForm
        date={DATE}
        timezone="Europe/Berlin"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        submitting={false}
      />,
    );
    await userEvent.type(screen.getByLabelText(/количество/i), "300");
    await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ localDate: "2026-01-05", amount: 300, timezone: "Europe/Berlin" }),
    );
  });

  it("disables submit while an amount is invalid/empty", () => {
    render(<TransactionForm date={DATE} timezone="UTC" onSubmit={vi.fn()} onCancel={vi.fn()} submitting={false} />);
    expect(screen.getByRole("button", { name: /сохранить/i })).toBeDisabled();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(<TransactionForm date={DATE} timezone="UTC" onSubmit={vi.fn()} onCancel={onCancel} submitting={false} />);
    await userEvent.click(screen.getByRole("button", { name: /отмена/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
