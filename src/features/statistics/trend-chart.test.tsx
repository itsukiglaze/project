// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrendChart } from "./trend-chart";
import type { StatisticsTimelinePointDto } from "./api";

function point(overrides: Partial<StatisticsTimelinePointDto>): StatisticsTimelinePointDto {
  return {
    date: "2026-01-15",
    actualIncomePolychrome: 0,
    actualExpensePolychrome: 0,
    actualPulls: 0,
    actualCumulativeNetPolychrome: null,
    scheduledIncomePolychrome: 0,
    scheduledExpensePolychrome: 0,
    scheduledPulls: 0,
    projectedCumulativeNetPolychrome: null,
    ...overrides,
  };
}

const TIMELINE: StatisticsTimelinePointDto[] = [
  point({ date: "2026-01-14", actualCumulativeNetPolychrome: 100 }),
  point({ date: "2026-01-15", actualCumulativeNetPolychrome: 200, projectedCumulativeNetPolychrome: 200 }),
  point({ date: "2026-01-16", projectedCumulativeNetPolychrome: 260 }),
];

describe("TrendChart", () => {
  it("shows an empty state for an empty timeline", () => {
    render(<TrendChart timeline={[]} />);
    expect(screen.getByText(/нет данных за этот период/i)).toBeInTheDocument();
  });

  it("renders an accessible chart with a labeled role=img by default", () => {
    render(<TrendChart timeline={TIMELINE} />);
    expect(screen.getByRole("img", { name: /факт по сегодня.*запланировано/i })).toBeInTheDocument();
  });

  it("labels the chart honestly as a relative change, not the wallet balance", () => {
    render(<TrendChart timeline={TIMELINE} />);
    expect(screen.getByText(/не ваш реальный баланс кошелька/i)).toBeInTheDocument();
  });

  it("toggles to an accessible table with the same actual/projected data", async () => {
    render(<TrendChart timeline={TIMELINE} />);
    await userEvent.click(screen.getByRole("button", { name: /показать таблицей/i }));

    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByText("2026-01-14")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("260")).toBeInTheDocument();
  });

  it("shows a separate pull-count note, never folded into the chart's net line", () => {
    const withPulls = [point({ date: "2026-01-14", actualCumulativeNetPolychrome: 0, actualPulls: 5 })];
    render(<TrendChart timeline={withPulls} />);
    expect(screen.getByText(/круток за период: 5/i)).toBeInTheDocument();
  });

  it("does not show the pull note when there are no pulls in the period", () => {
    render(<TrendChart timeline={TIMELINE} />);
    expect(screen.queryByText(/круток за период/i)).not.toBeInTheDocument();
  });

  it("the view-toggle button meets the 44px touch-target minimum", () => {
    render(<TrendChart timeline={TIMELINE} />);
    expect(screen.getByRole("button", { name: /показать таблицей/i }).className).toMatch(/\bmin-h-11\b/);
  });
});
