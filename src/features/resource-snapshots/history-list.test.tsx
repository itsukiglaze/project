// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurrencyType } from "@/lib/calendar-math";
import { HistoryList } from "./history-list";
import type { ResourceSnapshotComparisonDto } from "./api";

function snapshot(localDate: string, note: string | null = null): ResourceSnapshotComparisonDto {
  return {
    record: {
      id: `snap-${localDate}`,
      localDate,
      capturedAt: `${localDate}T10:00:00.000Z`,
      timezone: "UTC",
      note,
      items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }],
      version: 1,
    },
    comparison: [{ currencyType: CurrencyType.POLYCHROME, current: 5000, status: "no_previous_snapshot" }],
    previousLocalDate: null,
  };
}

describe("HistoryList", () => {
  it("shows an empty message when there are no snapshots", () => {
    render(<HistoryList snapshots={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Сохранённых балансов пока нет.")).toBeInTheDocument();
  });

  it("lists snapshots newest-first", () => {
    render(<HistoryList snapshots={[snapshot("2026-07-20"), snapshot("2026-07-25")]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const headings = screen.getAllByText(/июля/);
    expect(headings[0]).toHaveTextContent("25 июля 2026");
    expect(headings[1]).toHaveTextContent("20 июля 2026");
  });

  it("shows the optional note when present", () => {
    render(<HistoryList snapshots={[snapshot("2026-07-25", "утренняя проверка")]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("утренняя проверка")).toBeInTheDocument();
  });

  it("edit/delete actions have accessible names that disambiguate the date, and call the right handler", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const s = snapshot("2026-07-25");
    render(<HistoryList snapshots={[s]} onEdit={onEdit} onDelete={onDelete} />);

    const editButton = screen.getByRole("button", { name: /изменить баланс за 25 июля/i });
    await userEvent.click(editButton);
    expect(onEdit).toHaveBeenCalledWith(s);

    const deleteButton = screen.getByRole("button", { name: /удалить баланс за 25 июля/i });
    await userEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith(s);
  });
});
