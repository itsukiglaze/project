// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurrencyType, TransactionType } from "@/lib/calendar-math";
import { QuickAmountForm } from "./quick-amount-form";

const DATE = { year: 2026, month: 7, day: 25 };

describe("QuickAmountForm", () => {
  it("defaults to 'Получено' and shows the source field", () => {
    render(<QuickAmountForm date={DATE} timezone="UTC" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Получено" })).toBeChecked();
    expect(screen.getByLabelText("Источник")).toBeInTheDocument();
  });

  it("hides the source field when 'Потрачено' is selected (EXPENSE has no source)", async () => {
    render(<QuickAmountForm date={DATE} timezone="UTC" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: "Потрачено" }));
    expect(screen.queryByLabelText("Источник")).not.toBeInTheDocument();
  });

  it("submits 'Получено' as TransactionType.INCOME with the chosen currency, amount, and source", async () => {
    const onSubmit = vi.fn();
    render(<QuickAmountForm date={DATE} timezone="UTC" submitting={false} onSubmit={onSubmit} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Количество"), "300");
    await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TransactionType.INCOME,
        currencyType: CurrencyType.POLYCHROME,
        amount: 300,
        localDate: "2026-07-25",
        timezone: "UTC",
      }),
    );
  });

  it("submits 'Потрачено' as TransactionType.EXPENSE with source: null", async () => {
    const onSubmit = vi.fn();
    render(<QuickAmountForm date={DATE} timezone="UTC" submitting={false} onSubmit={onSubmit} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: "Потрачено" }));
    await userEvent.type(screen.getByLabelText("Количество"), "10");
    await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: TransactionType.EXPENSE, amount: 10, source: null }),
    );
  });

  it("disables Save until a valid amount is entered", () => {
    render(<QuickAmountForm date={DATE} timezone="UTC" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /сохранить/i })).toBeDisabled();
  });

  it("Cancel calls onCancel", async () => {
    const onCancel = vi.fn();
    render(<QuickAmountForm date={DATE} timezone="UTC" submitting={false} onSubmit={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: /отмена/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
