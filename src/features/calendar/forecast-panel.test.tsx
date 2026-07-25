// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurrencyType, IncomeSource, TransactionType } from "@/lib/calendar-math";
import type { MergedOccurrenceDto } from "./api";

const mockFetchForecast = vi.fn();

vi.mock("./api", () => ({
  fetchForecast: (...args: unknown[]) => mockFetchForecast(...args),
}));

import { ForecastPanel } from "./forecast-panel";

function virtual(overrides: Partial<Extract<MergedOccurrenceDto, { kind: "virtual" }>> = {}): MergedOccurrenceDto {
  return {
    kind: "virtual",
    seriesId: "series-1",
    occurrenceDate: "2026-01-05",
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 60,
    source: IncomeSource.DAILY,
    bannerFamily: null,
    note: null,
    ...overrides,
  };
}

function forecastData(overrides: Record<string, unknown> = {}) {
  return {
    requestedHorizonDays: 30,
    effectiveHorizonDays: 30,
    rangeStart: "2026-01-15",
    rangeEnd: "2026-02-14",
    occurrences: [],
    dailyBalances: [],
    projectedEndingBalance: 0,
    ...overrides,
  };
}

describe("ForecastPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renames the heading to 'Прогноз на ближайшие N дней'", async () => {
    mockFetchForecast.mockResolvedValue({ status: "success", data: forecastData() });
    render(<ForecastPanel />);
    expect(await screen.findByText("Прогноз на ближайшие 30 дней")).toBeInTheDocument();
  });

  it("never shows a bare unit-less number — an empty forecast still shows '0 Полихромы'", async () => {
    mockFetchForecast.mockResolvedValue({ status: "success", data: forecastData() });
    render(<ForecastPanel />);
    await screen.findByText("Ожидаемые поступления");
    // Both the income row and the balance row show an explicit "0 <currency>", never a bare "0".
    expect(screen.getAllByText("0 Полихромы")).toHaveLength(2);
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it("clearly distinguishes expected income from the ending balance as separate labelled rows", async () => {
    mockFetchForecast.mockResolvedValue({
      status: "success",
      data: forecastData({
        occurrences: [virtual({ amount: 300 })],
        projectedEndingBalance: 900,
      }),
    });
    render(<ForecastPanel />);
    expect(await screen.findByText("Ожидаемые поступления")).toBeInTheDocument();
    expect(screen.getByText("300 Полихромы")).toBeInTheDocument();
    expect(screen.getByText(/Баланс к/)).toBeInTheDocument();
    expect(screen.getByText("900 Полихромы")).toBeInTheDocument();
  });

  it("shows a separate row per currency instead of merging amounts together", async () => {
    mockFetchForecast.mockResolvedValue({
      status: "success",
      data: forecastData({
        occurrences: [
          virtual({ currencyType: CurrencyType.POLYCHROME, amount: 300 }),
          virtual({ currencyType: CurrencyType.BOOPON, amount: 5 }),
        ],
      }),
    });
    render(<ForecastPanel />);
    expect(await screen.findByText("300 Полихромы")).toBeInTheDocument();
    expect(screen.getByText("5 Boopon")).toBeInTheDocument();
  });

  it("omits a single misleading ending-balance figure when multiple currencies are in play, explaining why instead", async () => {
    mockFetchForecast.mockResolvedValue({
      status: "success",
      data: forecastData({
        occurrences: [
          virtual({ currencyType: CurrencyType.POLYCHROME, amount: 300 }),
          virtual({ currencyType: CurrencyType.BOOPON, amount: 5 }),
        ],
        projectedEndingBalance: 305,
      }),
    });
    render(<ForecastPanel />);
    await screen.findByText("300 Полихромы");
    expect(screen.queryByText("305 Полихромы")).not.toBeInTheDocument();
    expect(screen.getByText(/недоступен одной суммой/i)).toBeInTheDocument();
  });

  it("shows the 'Примерный прогноз' badge as plain text, never as a button", async () => {
    mockFetchForecast.mockResolvedValue({ status: "success", data: forecastData() });
    render(<ForecastPanel />);
    const badge = await screen.findByText("Примерный прогноз");
    expect(badge.tagName).not.toBe("BUTTON");
    expect(badge).not.toHaveAttribute("role", "button");
    expect(screen.queryByRole("button", { name: /примерный прогноз/i })).not.toBeInTheDocument();
  });

  it("keeps the guarantee-disclaimer explanation", async () => {
    mockFetchForecast.mockResolvedValue({ status: "success", data: forecastData() });
    render(<ForecastPanel />);
    expect(
      await screen.findByText(/не гарантирует фактическое получение ресурсов/i),
    ).toBeInTheDocument();
  });

  it("shows a contextual error message with a retry button naming what it retries", async () => {
    mockFetchForecast.mockResolvedValue({ status: "network_error" });
    render(<ForecastPanel />);
    expect(await screen.findByText("Не удалось загрузить прогноз.")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /повторить загрузку прогноза/i });
    expect(retry).toBeInTheDocument();

    mockFetchForecast.mockResolvedValue({ status: "success", data: forecastData() });
    await userEvent.click(retry);
    expect(await screen.findByText("Прогноз на ближайшие 30 дней")).toBeInTheDocument();
  });
});
