// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BannerFamily } from "@/config/gacha";
import { CurrencyType } from "@/lib/calendar-math";
import { TotalsPanel } from "./totals-panel";
import type { StatisticsOverviewDto } from "./api";

const OVERVIEW: StatisticsOverviewDto = {
  range: { from: "2026-01-01", to: "2026-01-31", today: "2026-01-15", timezone: "UTC" },
  actual: {
    incomeTotals: [{ currency: CurrencyType.POLYCHROME, amount: 500 }],
    expenseTotals: [{ currency: CurrencyType.POLYCHROME, amount: 100 }],
    pullTotals: [{ bannerFamily: BannerFamily.EXCLUSIVE_AGENT, currency: CurrencyType.ENCRYPTED_MASTER_TAPE, pulls: 3 }],
    netFlowPolychrome: 400,
  },
  scheduled: {
    incomeTotals: [{ currency: CurrencyType.POLYCHROME, amount: 60 }],
    expenseTotals: [],
    pullTotals: [],
    netFlowPolychrome: 60,
  },
  expectedRangeTotal: {
    income: [{ currency: CurrencyType.POLYCHROME, amount: 560 }],
    expense: [{ currency: CurrencyType.POLYCHROME, amount: 100 }],
    pulls: [{ bannerFamily: BannerFamily.EXCLUSIVE_AGENT, currency: CurrencyType.ENCRYPTED_MASTER_TAPE, pulls: 3 }],
    netFlowPolychrome: 460,
  },
  timeline: [],
  breakdowns: { bySource: [], byBannerFamily: [], byTransactionType: [] },
};

describe("TotalsPanel", () => {
  it("shows honest labels: Actual through today / Scheduled ahead / Expected range total", () => {
    render(<TotalsPanel overview={OVERVIEW} />);
    expect(screen.getByText(/факт по сегодня/i)).toBeInTheDocument();
    expect(screen.getByText(/запланировано вперёд/i)).toBeInTheDocument();
    expect(screen.getByText(/ожидаемый итог за период/i)).toBeInTheDocument();
    // Never claims to compare against a past forecast.
    expect(screen.queryByText(/точность прогноза/i)).not.toBeInTheDocument();
  });

  it("shows currency amounts as a chart by default, never blending currencies", () => {
    render(<TotalsPanel overview={OVERVIEW} />);
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getAllByText("100").length).toBeGreaterThan(0);
  });

  it("toggles to a table view with the same data", async () => {
    render(<TotalsPanel overview={OVERVIEW} />);
    await userEvent.click(screen.getByRole("button", { name: /показать таблицей/i }));
    expect(screen.getAllByRole("table").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /показать графиком/i })).toBeInTheDocument();
  });

  it("shows pull counts by banner family, separate from income/expense", () => {
    render(<TotalsPanel overview={OVERVIEW} />);
    expect(screen.getAllByText(/EXCLUSIVE_AGENT.*3/).length).toBeGreaterThan(0);
  });

  it("shows an empty-state message for a bucket with no data", () => {
    const empty: StatisticsOverviewDto = {
      ...OVERVIEW,
      scheduled: { incomeTotals: [], expenseTotals: [], pullTotals: [], netFlowPolychrome: 0 },
    };
    render(<TotalsPanel overview={empty} />);
    const scheduledSection = screen.getByText(/запланировано вперёд/i).closest("div")!;
    expect(within(scheduledSection).getByText(/нет данных за этот период/i)).toBeInTheDocument();
  });

  it("the view-toggle button meets the 44px touch-target minimum", () => {
    render(<TotalsPanel overview={OVERVIEW} />);
    expect(screen.getByRole("button", { name: /показать таблицей/i }).className).toMatch(/\bmin-h-11\b/);
  });
});
