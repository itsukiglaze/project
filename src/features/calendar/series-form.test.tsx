// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CurrencyType,
  IncomeSource,
  RecurrenceEndType,
  RecurrenceFrequency,
  TransactionType,
} from "@/lib/calendar-math";
import { SeriesForm } from "./series-form";
import type { SeriesRecordDto } from "./api";

const EXISTING: SeriesRecordDto = {
  id: "series-1",
  type: TransactionType.EXPENSE,
  currencyType: CurrencyType.MASTER_TAPE,
  amount: 500,
  source: null,
  bannerFamily: null,
  note: "Existing note",
  rule: {
    frequency: RecurrenceFrequency.WEEKLY,
    interval: 1,
    daysOfWeek: [1, 3],
    dayOfMonth: null,
    startDate: "2026-01-01",
    endType: RecurrenceEndType.NEVER,
    endDate: null,
    occurrenceCount: null,
  },
  timezone: "Europe/Berlin",
  isActive: true,
  splitFromSeriesId: null,
  version: 3,
};

describe("SeriesForm", () => {
  describe("create mode", () => {
    it("defaults to INCOME type with the source field visible", () => {
      render(<SeriesForm mode="create" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      const incomeRadio = screen.getByRole("radio", { name: "Доход" });
      expect(incomeRadio).toHaveAttribute("aria-checked", "true");
      expect(screen.getByLabelText(/источник/i)).toBeInTheDocument();
    });

    it("switches to EXPENSE and hides the source field", async () => {
      render(<SeriesForm mode="create" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      await userEvent.click(screen.getByRole("radio", { name: "Расход" }));
      expect(screen.getByRole("radio", { name: "Расход" })).toHaveAttribute("aria-checked", "true");
      expect(screen.queryByLabelText(/источник/i)).not.toBeInTheDocument();
    });

    it("shows the weekday picker only for WEEKLY frequency", async () => {
      render(<SeriesForm mode="create" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.queryByLabelText(/дни недели/i)).not.toBeInTheDocument();
      await userEvent.selectOptions(screen.getByLabelText(/периодичность/i), RecurrenceFrequency.WEEKLY);
      expect(screen.getByLabelText(/дни недели/i)).toBeInTheDocument();
    });

    it("shows the day-of-month field only for MONTHLY frequency", async () => {
      render(<SeriesForm mode="create" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      await userEvent.selectOptions(screen.getByLabelText(/периодичность/i), RecurrenceFrequency.MONTHLY);
      expect(screen.getByLabelText(/день месяца/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/дни недели/i)).not.toBeInTheDocument();
    });

    it("switching frequency resets daysOfWeek/dayOfMonth", async () => {
      render(<SeriesForm mode="create" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      await userEvent.selectOptions(screen.getByLabelText(/периодичность/i), RecurrenceFrequency.WEEKLY);
      await userEvent.click(screen.getByRole("button", { name: "Пн" }));
      expect(screen.getByRole("button", { name: "Пн" })).toHaveAttribute("aria-pressed", "true");
      await userEvent.selectOptions(screen.getByLabelText(/периодичность/i), RecurrenceFrequency.MONTHLY);
      await userEvent.selectOptions(screen.getByLabelText(/периодичность/i), RecurrenceFrequency.WEEKLY);
      expect(screen.getByRole("button", { name: "Пн" })).toHaveAttribute("aria-pressed", "false");
    });

    it("shows the end-date field only for UNTIL_DATE, and the count field only for AFTER_COUNT", async () => {
      render(<SeriesForm mode="create" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.queryByLabelText(/дата окончания/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/количество повторений/i)).not.toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText(/окончание/i), RecurrenceEndType.UNTIL_DATE);
      expect(screen.getByLabelText(/дата окончания/i)).toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText(/окончание/i), RecurrenceEndType.AFTER_COUNT);
      expect(screen.queryByLabelText(/дата окончания/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/количество повторений/i)).toBeInTheDocument();
    });

    it("allows editing the start date", () => {
      render(<SeriesForm mode="create" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByLabelText(/дата начала/i)).toBeInTheDocument();
    });

    it("blocks submit when the amount is empty/invalid", async () => {
      render(<SeriesForm mode="create" submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      const submit = screen.getByRole("button", { name: /сохранить/i });
      expect(submit).toBeDisabled();
      expect(screen.getByText(/введите значение/i)).toBeInTheDocument();
    });

    it("submits the expected template and rule once the form is valid", async () => {
      const onSubmit = vi.fn();
      render(<SeriesForm mode="create" submitting={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

      await userEvent.type(screen.getByLabelText(/количество за одно вхождение/i), "100");
      await userEvent.type(screen.getByLabelText(/дата начала/i), "2026-02-01");
      await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));

      expect(onSubmit).toHaveBeenCalledWith({
        template: {
          type: TransactionType.INCOME,
          currencyType: CurrencyType.POLYCHROME,
          amount: 100,
          source: IncomeSource.DAILY,
          bannerFamily: null,
          note: null,
        },
        rule: {
          frequency: RecurrenceFrequency.DAILY,
          interval: 1,
          daysOfWeek: [],
          dayOfMonth: null,
          startDate: "2026-02-01",
          endType: RecurrenceEndType.NEVER,
          endDate: null,
          occurrenceCount: null,
        },
      });
    });

    it("submits source: null for EXPENSE (source is INCOME-only)", async () => {
      const onSubmit = vi.fn();
      render(<SeriesForm mode="create" submitting={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

      await userEvent.click(screen.getByRole("radio", { name: "Расход" }));
      await userEvent.type(screen.getByLabelText(/количество за одно вхождение/i), "50");
      await userEvent.type(screen.getByLabelText(/дата начала/i), "2026-02-01");
      await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ template: expect.objectContaining({ type: TransactionType.EXPENSE, source: null }) }),
      );
    });

    it("calls onCancel when Отмена is clicked", async () => {
      const onCancel = vi.fn();
      render(<SeriesForm mode="create" submitting={false} onSubmit={vi.fn()} onCancel={onCancel} />);
      await userEvent.click(screen.getByRole("button", { name: /отмена/i }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("disables submit while submitting", () => {
      render(<SeriesForm mode="create" submitting onSubmit={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByRole("button", { name: /сохраняем/i })).toBeDisabled();
    });
  });

  describe("edit mode", () => {
    it("pre-fills all fields from the existing series", () => {
      render(<SeriesForm mode="edit" existing={EXISTING} submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByRole("radio", { name: "Расход" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByLabelText(/количество за одно вхождение/i)).toHaveValue("500");
      expect(screen.getByLabelText(/заметка/i)).toHaveValue("Existing note");
      expect(screen.getByLabelText(/дни недели/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Пн" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Ср" })).toHaveAttribute("aria-pressed", "true");
    });

    it("does not allow editing the start date, and shows it plus the frozen-timezone note as text instead", () => {
      render(<SeriesForm mode="edit" existing={EXISTING} submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.queryByLabelText(/дата начала/i)).not.toBeInTheDocument();
      expect(screen.getByText(/дата начала: 2026-01-01/i)).toBeInTheDocument();
      expect(screen.getByText(/часовой пояс серии зафиксирован/i)).toBeInTheDocument();
    });

    it("does not show the split banner", () => {
      render(<SeriesForm mode="edit" existing={EXISTING} submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.queryByText(/изменения применятся начиная с/i)).not.toBeInTheDocument();
    });

    it("submits the edited template/rule preserving the frozen start date", async () => {
      const onSubmit = vi.fn();
      render(<SeriesForm mode="edit" existing={EXISTING} submitting={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

      const amountField = screen.getByLabelText(/количество за одно вхождение/i);
      await userEvent.clear(amountField);
      await userEvent.type(amountField, "750");
      await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          template: expect.objectContaining({ amount: 750 }),
          rule: expect.objectContaining({ startDate: "2026-01-01" }),
        }),
      );
    });
  });

  describe("split mode", () => {
    const SPLIT_DATE = { year: 2026, month: 3, day: 15 };

    it("shows the split banner mentioning the split date", () => {
      render(
        <SeriesForm
          mode="split"
          existing={EXISTING}
          splitDate={SPLIT_DATE}
          submitting={false}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(screen.getByText(/изменения применятся начиная с 2026-03-15/i)).toBeInTheDocument();
      expect(screen.getByText(/прошлые записи не изменятся/i)).toBeInTheDocument();
    });

    it("does not allow editing the start date (it is fixed to the split date)", () => {
      render(
        <SeriesForm
          mode="split"
          existing={EXISTING}
          splitDate={SPLIT_DATE}
          submitting={false}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(screen.queryByLabelText(/дата начала/i)).not.toBeInTheDocument();
      expect(screen.getByText(/дата начала: 2026-03-15/i)).toBeInTheDocument();
    });

    it("submits with the rule's startDate set to the split date, not the original series start date", async () => {
      const onSubmit = vi.fn();
      render(
        <SeriesForm
          mode="split"
          existing={EXISTING}
          splitDate={SPLIT_DATE}
          submitting={false}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ rule: expect.objectContaining({ startDate: "2026-03-15" }) }),
      );
    });
  });
});
