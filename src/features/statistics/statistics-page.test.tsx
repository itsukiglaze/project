// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BannerFamily } from "@/config/gacha";
import { CurrencyType } from "@/lib/calendar-math";

const mockFetchStatisticsOverview = vi.fn();
const mockFetchResourceSnapshot = vi.fn();
const mockFetchAllBannerStates = vi.fn();

vi.mock("./api", () => ({
  fetchStatisticsOverview: (...args: unknown[]) => mockFetchStatisticsOverview(...args),
}));
vi.mock("@/features/profile/api", () => ({
  fetchResourceSnapshot: (...args: unknown[]) => mockFetchResourceSnapshot(...args),
  fetchAllBannerStates: (...args: unknown[]) => mockFetchAllBannerStates(...args),
}));
vi.mock("@/features/calendar/local-date-client", () => ({
  getTodayLocalDate: () => ({ year: 2026, month: 1, day: 15 }),
}));

import { StatisticsPage } from "./statistics-page";

const EMPTY_OVERVIEW = {
  range: { from: "2025-12-16", to: "2026-02-14", today: "2026-01-15", timezone: "UTC" },
  actual: { incomeTotals: [], expenseTotals: [], pullTotals: [], netFlowPolychrome: 0 },
  scheduled: { incomeTotals: [], expenseTotals: [], pullTotals: [], netFlowPolychrome: 0 },
  expectedRangeTotal: { income: [], expense: [], pulls: [], netFlowPolychrome: 0 },
  timeline: [],
  breakdowns: { bySource: [], byBannerFamily: [], byTransactionType: [] },
};

const RESOURCES = {
  status: "success",
  data: { polychrome: 100, monochrome: 0, encryptedMasterTape: 0, masterTape: 0, boopon: 0, version: 1 },
};

const BANNER_STATES = {
  status: "success",
  data: {
    bannerStates: [
      { family: BannerFamily.EXCLUSIVE_AGENT, sRankPity: 0, aRankPity: 0, guaranteeActive: false, version: 1 },
      { family: BannerFamily.W_ENGINE, sRankPity: 0, aRankPity: 0, guaranteeActive: false, version: 1 },
      { family: BannerFamily.STABLE, sRankPity: 0, aRankPity: 0, guaranteeActive: false, version: 1 },
      { family: BannerFamily.BANGBOO, sRankPity: 0, aRankPity: 0, guaranteeActive: false, version: 1 },
    ],
  },
};

describe("StatisticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchResourceSnapshot.mockResolvedValue(RESOURCES);
    mockFetchAllBannerStates.mockResolvedValue(BANNER_STATES);
  });

  it("shows a loading skeleton while the overview is loading", () => {
    mockFetchStatisticsOverview.mockReturnValue(new Promise(() => {}));
    render(<StatisticsPage />);
    expect(screen.queryByText(/итоги за период/i)).not.toBeInTheDocument();
  });

  it("shows an error state with a retry button on failure", async () => {
    mockFetchStatisticsOverview.mockResolvedValue({ status: "network_error" });
    render(<StatisticsPage />);
    expect(await screen.findByRole("alert", { name: undefined })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /повторить/i })).toBeInTheDocument();
  });

  it("retry re-issues the request", async () => {
    mockFetchStatisticsOverview.mockResolvedValueOnce({ status: "network_error" });
    render(<StatisticsPage />);
    await screen.findByRole("button", { name: /повторить/i });

    mockFetchStatisticsOverview.mockResolvedValueOnce({ status: "success", data: EMPTY_OVERVIEW });
    await userEvent.click(screen.getByRole("button", { name: /повторить/i }));

    expect(await screen.findByText(/итоги за период/i)).toBeInTheDocument();
    expect(mockFetchStatisticsOverview).toHaveBeenCalledTimes(2);
  });

  it("shows an empty-range message when there is no data at all", async () => {
    mockFetchStatisticsOverview.mockResolvedValue({ status: "success", data: EMPTY_OVERVIEW });
    render(<StatisticsPage />);
    expect(await screen.findByText(/нет ни фактических, ни запланированных операций/i)).toBeInTheDocument();
  });

  it("renders resource balance, banner pity, totals, trend chart, and trends panels on success", async () => {
    mockFetchStatisticsOverview.mockResolvedValue({
      status: "success",
      data: {
        ...EMPTY_OVERVIEW,
        actual: {
          incomeTotals: [{ currency: CurrencyType.POLYCHROME, amount: 300 }],
          expenseTotals: [],
          pullTotals: [],
          netFlowPolychrome: 300,
        },
        timeline: [
          {
            date: "2026-01-15",
            actualIncomePolychrome: 300,
            actualExpensePolychrome: 0,
            actualPulls: 0,
            actualCumulativeNetPolychrome: 300,
            scheduledIncomePolychrome: 0,
            scheduledExpensePolychrome: 0,
            scheduledPulls: 0,
            projectedCumulativeNetPolychrome: 300,
          },
        ],
      },
    });

    render(<StatisticsPage />);

    expect(await screen.findByText(/текущий баланс ресурсов/i)).toBeInTheDocument();
    expect(await screen.findByText(/pity и гарантия/i)).toBeInTheDocument();
    expect(await screen.findByText(/итоги за период/i)).toBeInTheDocument();
    expect(await screen.findByText(/изменение баланса \(полихромы\)/i)).toBeInTheDocument();
    expect(await screen.findByText(/тренды операций/i)).toBeInTheDocument();
  });

  it("documents the calendar-net-flow vs wallet-balance distinction and the lack of retrospective forecast accuracy", async () => {
    mockFetchStatisticsOverview.mockResolvedValue({ status: "success", data: EMPTY_OVERVIEW });
    render(<StatisticsPage />);
    expect(await screen.findByText(/что означает эта статистика/i)).toBeInTheDocument();
    expect(screen.getByText(/не ваш реальный баланс кошелька из настроек/i)).toBeInTheDocument();
    expect(screen.getByText(/ретроспективная точность прогноза/i)).toBeInTheDocument();
  });

  it("changing the date range re-issues the overview request with the new range", async () => {
    mockFetchStatisticsOverview.mockResolvedValue({ status: "success", data: EMPTY_OVERVIEW });
    render(<StatisticsPage />);
    await screen.findByText(/нет ни фактических/i);

    const callsBefore = mockFetchStatisticsOverview.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "±7 дней" }));

    expect(mockFetchStatisticsOverview.mock.calls.length).toBeGreaterThan(callsBefore);
    const lastCall = mockFetchStatisticsOverview.mock.calls.at(-1)!;
    expect(lastCall).toEqual([{ year: 2026, month: 1, day: 8 }, { year: 2026, month: 1, day: 22 }]);
  });
});
