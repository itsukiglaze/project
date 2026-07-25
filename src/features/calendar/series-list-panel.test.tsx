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
import { SeriesListPanel } from "./series-list-panel";
import type { SeriesRecordDto } from "./api";

function series(overrides: Partial<SeriesRecordDto> = {}): SeriesRecordDto {
  return {
    id: "series-1",
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 60,
    source: IncomeSource.DAILY,
    bannerFamily: null,
    note: null,
    rule: {
      frequency: RecurrenceFrequency.DAILY,
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: null,
      startDate: "2020-01-01",
      endType: RecurrenceEndType.NEVER,
      endDate: null,
      occurrenceCount: null,
    },
    timezone: "UTC",
    isActive: true,
    splitFromSeriesId: null,
    version: 1,
    ...overrides,
  };
}

function query(data: { series: SeriesRecordDto[] } | null, status: "loading" | "success" | "error" = "success") {
  const refetch = vi.fn();
  if (status === "loading") return { status: "loading" as const, refetch };
  if (status === "error") return { status: "error" as const, result: { status: "network_error" as const }, refetch };
  return { status: "success" as const, data: data!, refetch };
}

describe("SeriesListPanel", () => {
  it("renames the heading to 'Регулярные источники' and the create button to '+ Добавить источник'", () => {
    render(<SeriesListPanel query={query({ series: [] })} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Регулярные источники" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Добавить источник" })).toBeInTheDocument();
  });

  it("renames the empty state and adds an example helper line", () => {
    render(<SeriesListPanel query={query({ series: [] })} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Регулярных источников пока нет.")).toBeInTheDocument();
    expect(
      screen.getByText(/например: ежедневные задания, еженедельные награды, пропуск или событие/i),
    ).toBeInTheDocument();
  });

  it("shows the source name, recurrence in plain Russian, amount and currency, and the next expected date", () => {
    render(
      <SeriesListPanel
        query={query({ series: [series()] })}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Ежедневные задания")).toBeInTheDocument();
    expect(screen.getByText(/Ежедневно · 60 Полихромы/)).toBeInTheDocument();
    expect(screen.getByText(/Следующее ожидается/)).toBeInTheDocument();
  });

  it("does not show a next-expected-date line for an inactive series", () => {
    render(
      <SeriesListPanel
        query={query({ series: [series({ isActive: false })] })}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Следующее ожидается/)).not.toBeInTheDocument();
  });

  it("gives edit/delete actions accessible names that disambiguate between multiple sources", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <SeriesListPanel
        query={query({
          series: [
            series({ id: "a", source: IncomeSource.DAILY }),
            series({ id: "b", source: IncomeSource.BATTLE_PASS, amount: 200 }),
          ],
        })}
        onCreate={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    const editDaily = screen.getByRole("button", { name: /изменить источник «ежедневные задания»/i });
    const editPass = screen.getByRole("button", { name: /изменить источник «боевой пропуск»/i });
    expect(editDaily).toBeInTheDocument();
    expect(editPass).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /удалить источник «ежедневные задания»/i })).toBeInTheDocument();
  });

  it("clicking edit/delete calls the corresponding handler with the right series", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const s = series();
    render(<SeriesListPanel query={query({ series: [s] })} onCreate={vi.fn()} onEdit={onEdit} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: /^изменить источник/i }));
    expect(onEdit).toHaveBeenCalledWith(s);
    await userEvent.click(screen.getByRole("button", { name: /^удалить источник/i }));
    expect(onDelete).toHaveBeenCalledWith(s);
  });

  it("shows a contextual error message with a retry button naming what it retries", async () => {
    const refetch = vi.fn();
    render(
      <SeriesListPanel
        query={{ status: "error", result: { status: "network_error" }, refetch }}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Не удалось загрузить регулярные источники.")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /повторить загрузку источников/i });
    await userEvent.click(retry);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
