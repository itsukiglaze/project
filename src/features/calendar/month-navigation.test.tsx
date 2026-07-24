// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthNavigation } from "./month-navigation";

describe("MonthNavigation", () => {
  it("renders the month and year label", () => {
    render(
      <MonthNavigation
        yearMonth={{ year: 2026, month: 1 }}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />,
    );
    expect(screen.getByText(/январь 2026/i)).toBeInTheDocument();
  });

  it("calls onPrev when the previous button is clicked", async () => {
    const onPrev = vi.fn();
    render(
      <MonthNavigation
        yearMonth={{ year: 2026, month: 1 }}
        onPrev={onPrev}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/предыдущий месяц/i));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when the next button is clicked", async () => {
    const onNext = vi.fn();
    render(
      <MonthNavigation
        yearMonth={{ year: 2026, month: 1 }}
        onPrev={vi.fn()}
        onNext={onNext}
        onToday={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText(/следующий месяц/i));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onToday when the today button is clicked", async () => {
    const onToday = vi.fn();
    render(
      <MonthNavigation
        yearMonth={{ year: 2026, month: 1 }}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToday={onToday}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /сегодня/i }));
    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it("all interactive controls meet the 44px touch-target minimum height", () => {
    render(
      <MonthNavigation
        yearMonth={{ year: 2026, month: 1 }}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/предыдущий месяц/i)).toHaveClass("h-11");
    expect(screen.getByLabelText(/следующий месяц/i)).toHaveClass("h-11");
  });
});
