// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CurrencyType,
  IncomeSource,
  RecurrenceEndType,
  RecurrenceFrequency,
  TransactionType,
} from "@/lib/calendar-math";
import { ConfirmDialog } from "./confirm-dialog";
import { EditScopeDialog } from "./edit-scope-dialog";
import { SeriesForm } from "./series-form";
import { TransactionForm } from "./transaction-form";
import { QuickAmountForm } from "./quick-amount-form";
import { DayCell } from "./day-cell";
import { MonthNavigation } from "./month-navigation";

/** Apple/Google's minimum recommended touch target is 44px — this codebase's
 * convention is the Tailwind `min-h-11`/`h-11` (2.75rem = 44px) utility on
 * every tappable control. This is a static-class check, not a real layout
 * measurement (jsdom doesn't apply Tailwind's stylesheet), but it verifies
 * every interactive control actually carries the sizing class rather than
 * silently falling back to a smaller default.
 */
function expectMinTouchTarget(element: Element) {
  expect(element.className).toMatch(/\b(min-h-11|h-11)\b/);
}

describe("Mobile interaction — touch target sizing", () => {
  it("ConfirmDialog's Cancel/Confirm buttons meet the 44px minimum", () => {
    render(<ConfirmDialog title="Title" message="msg" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) {
      expectMinTouchTarget(button);
    }
  });

  it("EditScopeDialog's option/cancel buttons meet the 44px minimum", () => {
    render(<EditScopeDialog onSelect={vi.fn()} onCancel={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) {
      expectMinTouchTarget(button);
    }
  });

  it("a day cell is a real <button> at least 56px tall (min-h-14), well above the 44px floor", () => {
    render(
      <DayCell
        cell={{ date: { year: 2026, month: 1, day: 15 }, isCurrentMonth: true }}
        today={{ year: 2026, month: 1, day: 15 }}
        summary={null}
        onSelect={vi.fn()}
      />,
    );
    const cell = screen.getByRole("button");
    expect(cell.className).toMatch(/\bmin-h-14\b/);
  });

  it("month navigation's prev/next buttons are real 44x44 targets", () => {
    render(<MonthNavigation yearMonth={{ year: 2026, month: 1 }} onPrev={vi.fn()} onNext={vi.fn()} onToday={vi.fn()} />);
    expectMinTouchTarget(screen.getByRole("button", { name: /предыдущий месяц/i }));
    expectMinTouchTarget(screen.getByRole("button", { name: /следующий месяц/i }));
  });

  describe("SeriesForm", () => {
    it("type toggle and Cancel/Save buttons meet the 44px minimum", () => {
      render(<SeriesForm mode="create" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      for (const radio of screen.getAllByRole("radio")) {
        expectMinTouchTarget(radio);
      }
      for (const button of screen.getAllByRole("button", { name: /отмена|сохранить/i })) {
        expectMinTouchTarget(button);
      }
    });

    it("the weekday picker (a grid of small day-abbreviation buttons — the easiest to get wrong) also meets the 44px minimum", () => {
      // A separate render (not a rerender) with an existing WEEKLY series,
      // since SeriesForm's internal state is only seeded from `existing` on
      // first mount and wouldn't react to a prop change on the same instance.
      render(
        <SeriesForm
          mode="edit"
          existing={{
            id: "s1",
            type: TransactionType.INCOME,
            currencyType: CurrencyType.POLYCHROME,
            amount: 1,
            source: IncomeSource.DAILY,
            bannerFamily: null,
            note: null,
            rule: {
              frequency: RecurrenceFrequency.WEEKLY,
              interval: 1,
              daysOfWeek: [1],
              dayOfMonth: null,
              startDate: "2026-01-01",
              endType: RecurrenceEndType.NEVER,
              endDate: null,
              occurrenceCount: null,
            },
            timezone: "UTC",
            isActive: true,
            splitFromSeriesId: null,
            version: 1,
          }}
          submitting={false}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      const weekdayButtons = screen.getAllByRole("button", { name: /^(Вс|Пн|Вт|Ср|Чт|Пт|Сб)$/ });
      expect(weekdayButtons.length).toBeGreaterThan(0);
      for (const button of weekdayButtons) {
        expect(button.className).toMatch(/\bmin-h-11\b/);
        expect(button.className).toMatch(/\bmin-w-11\b/);
      }
    });
  });

  it("TransactionForm's type toggle and Cancel/Save buttons meet the 44px minimum", () => {
    render(
      <TransactionForm
        date={{ year: 2026, month: 1, day: 15 }}
        timezone="UTC"
        submitting={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    for (const radio of screen.getAllByRole("radio")) {
      expectMinTouchTarget(radio);
    }
    for (const button of screen.getAllByRole("button", { name: /отмена|сохранить/i })) {
      expectMinTouchTarget(button);
    }
  });

  it("QuickAmountForm's direction toggle, amount field, and Cancel/Save buttons meet the 44px minimum", () => {
    render(
      <QuickAmountForm
        date={{ year: 2026, month: 1, day: 15 }}
        timezone="UTC"
        submitting={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    for (const radio of screen.getAllByRole("radio")) {
      expectMinTouchTarget(radio);
    }
    expectMinTouchTarget(screen.getByLabelText("Количество"));
    for (const button of screen.getAllByRole("button", { name: /отмена|сохранить/i })) {
      expectMinTouchTarget(button);
    }
  });
});
