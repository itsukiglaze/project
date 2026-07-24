// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  CurrencyType,
  IncomeSource,
  RecurrenceEndType,
  RecurrenceFrequency,
  TransactionType,
} from "@/lib/calendar-math";
import type { MergedOccurrenceDto, SeriesRecordDto } from "./api";

const mockFetchSeriesList = vi.fn();
const mockFetchOccurrences = vi.fn();
const mockFetchForecast = vi.fn();
const mockSplitSeries = vi.fn();
const mockCreateSeries = vi.fn();
const mockUpdateSeries = vi.fn();
const mockDeleteSeries = vi.fn();
const mockCreateTransaction = vi.fn();
const mockUpdateTransaction = vi.fn();
const mockDeleteTransaction = vi.fn();
const mockUpsertException = vi.fn();

vi.mock("./api", () => ({
  fetchSeriesList: (...args: unknown[]) => mockFetchSeriesList(...args),
  fetchOccurrences: (...args: unknown[]) => mockFetchOccurrences(...args),
  fetchForecast: (...args: unknown[]) => mockFetchForecast(...args),
  splitSeries: (...args: unknown[]) => mockSplitSeries(...args),
  createSeries: (...args: unknown[]) => mockCreateSeries(...args),
  updateSeries: (...args: unknown[]) => mockUpdateSeries(...args),
  deleteSeries: (...args: unknown[]) => mockDeleteSeries(...args),
  createTransaction: (...args: unknown[]) => mockCreateTransaction(...args),
  updateTransaction: (...args: unknown[]) => mockUpdateTransaction(...args),
  deleteTransaction: (...args: unknown[]) => mockDeleteTransaction(...args),
  upsertException: (...args: unknown[]) => mockUpsertException(...args),
}));

vi.mock("./local-date-client", () => ({
  getTodayLocalDate: () => ({ year: 2026, month: 1, day: 15 }),
}));

import { CalendarPage } from "./calendar-page";

const SERIES: SeriesRecordDto = {
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
    startDate: "2026-01-01",
    endType: RecurrenceEndType.NEVER,
    endDate: null,
    occurrenceCount: null,
  },
  timezone: "UTC",
  isActive: true,
  splitFromSeriesId: null,
  version: 2,
};

const VIRTUAL_OCCURRENCE: MergedOccurrenceDto = {
  kind: "virtual",
  seriesId: "series-1",
  occurrenceDate: "2026-01-15",
  type: TransactionType.INCOME,
  currencyType: CurrencyType.POLYCHROME,
  amount: 60,
  source: IncomeSource.DAILY,
  bannerFamily: null,
  note: null,
};

function setupSuccessfulQueries() {
  mockFetchSeriesList.mockResolvedValue({ status: "success", data: { series: [SERIES] } });
  mockFetchOccurrences.mockResolvedValue({ status: "success", data: { occurrences: [VIRTUAL_OCCURRENCE] } });
  mockFetchForecast.mockResolvedValue({
    status: "success",
    data: {
      requestedHorizonDays: 30,
      effectiveHorizonDays: 30,
      rangeStart: "2026-01-15",
      rangeEnd: "2026-02-14",
      occurrences: [],
      dailyBalances: [],
      projectedEndingBalance: 0,
    },
  });
}

/** Renders CalendarPage and drives the UI up to the split-series form being open. */
async function openSplitForm() {
  render(<CalendarPage />);
  const dayCell = await screen.findByRole("button", { name: /2026-01-15/ });
  await userEvent.click(dayCell);

  const daySheet = await screen.findByRole("dialog", { name: /2026-01-15/ });
  await userEvent.click(within(daySheet).getByRole("button", { name: /изменить/i }));

  const scopeDialog = await screen.findByRole("dialog", { name: /область изменения/i });
  await userEvent.click(within(scopeDialog).getByText(/это и будущие вхождения/i));

  return screen.findByRole("dialog", { name: /разделить серию/i });
}

describe("CalendarPage — split flow ('this and future')", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuccessfulQueries();
  });

  it("opens edit-scope from a virtual occurrence, then the split form pre-filled from the loaded series", async () => {
    const splitDialog = await openSplitForm();
    expect(within(splitDialog).getByText(/изменения применятся начиная с 2026-01-15/i)).toBeInTheDocument();
    // Pre-filled from the loaded series (amount 60), not left blank.
    expect(within(splitDialog).getByLabelText(/количество за одно вхождение/i)).toHaveValue("60");
  });

  it("submits the split with the exact args, invalidates series/occurrences/forecast, and closes the dialog", async () => {
    mockSplitSeries.mockResolvedValue({
      status: "success",
      data: { ok: true, mode: "SPLIT", oldSeries: SERIES, newSeries: { ...SERIES, id: "series-2" }, reassignedExceptionCount: 0, replay: false },
    });

    const splitDialog = await openSplitForm();
    const fetchOccurrencesCallsBeforeSubmit = mockFetchOccurrences.mock.calls.length;
    const fetchSeriesListCallsBeforeSubmit = mockFetchSeriesList.mock.calls.length;

    await userEvent.click(within(splitDialog).getByRole("button", { name: /сохранить/i }));

    expect(mockSplitSeries).toHaveBeenCalledTimes(1);
    expect(mockSplitSeries).toHaveBeenCalledWith(
      "series-1",
      {
        type: TransactionType.INCOME,
        currencyType: CurrencyType.POLYCHROME,
        amount: 60,
        source: IncomeSource.DAILY,
        bannerFamily: null,
        note: null,
      },
      {
        frequency: RecurrenceFrequency.DAILY,
        interval: 1,
        daysOfWeek: [],
        dayOfMonth: null,
        startDate: "2026-01-15",
        endType: RecurrenceEndType.NEVER,
        endDate: null,
        occurrenceCount: null,
      },
      { year: 2026, month: 1, day: 15 },
      2,
      expect.any(String),
    );

    // Dialog closes on success.
    expect(screen.queryByRole("dialog", { name: /разделить серию/i })).not.toBeInTheDocument();

    // Targeted cache invalidation refetches series list + occurrences + forecast.
    expect(mockFetchOccurrences.mock.calls.length).toBeGreaterThan(fetchOccurrencesCallsBeforeSubmit);
    expect(mockFetchSeriesList.mock.calls.length).toBeGreaterThan(fetchSeriesListCallsBeforeSubmit);
    expect(mockFetchForecast.mock.calls.length).toBeGreaterThan(1);
  });

  it("keeps the split dialog open and retryable on STALE_STATE, without looping the request", async () => {
    mockSplitSeries.mockResolvedValue({ status: "stale_state", current: { version: 5 } });

    const splitDialog = await openSplitForm();
    await userEvent.click(within(splitDialog).getByRole("button", { name: /сохранить/i }));

    expect(mockSplitSeries).toHaveBeenCalledTimes(1);
    // Still open — a conflict must not silently close the form.
    const stillOpenDialog = await screen.findByRole("dialog", { name: /разделить серию/i });
    const retryButton = within(stillOpenDialog).getByRole("button", { name: /сохранить/i });
    expect(retryButton).toBeEnabled();

    // Retrying re-issues the request rather than getting stuck.
    mockSplitSeries.mockResolvedValue({
      status: "success",
      data: { ok: true, mode: "SPLIT", oldSeries: SERIES, newSeries: { ...SERIES, id: "series-2" }, reassignedExceptionCount: 0, replay: false },
    });
    await userEvent.click(retryButton);
    expect(mockSplitSeries).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog", { name: /разделить серию/i })).not.toBeInTheDocument();
  });

  it("closes the split dialog and returns to the calendar when cancelled", async () => {
    const splitDialog = await openSplitForm();
    await userEvent.click(within(splitDialog).getByRole("button", { name: /отмена/i }));
    expect(screen.queryByRole("dialog", { name: /разделить серию/i })).not.toBeInTheDocument();
    expect(mockSplitSeries).not.toHaveBeenCalled();
  });
});
