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
const mockFetchLatestSnapshot = vi.fn();

vi.mock("@/features/resource-snapshots/api", () => ({
  fetchLatestSnapshot: (...args: unknown[]) => mockFetchLatestSnapshot(...args),
  fetchSnapshotHistory: vi.fn(),
  saveSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
}));

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

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: {
      id: "user-1",
      telegramId: "1",
      username: null,
      firstName: null,
      lastName: null,
      photoUrl: null,
      timezone: "UTC",
    },
    errorCode: null,
    authFailureCategory: null,
    launchPath: null,
    retry: () => undefined,
    completeLoginWidgetAuth: () => undefined,
  }),
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
  mockFetchLatestSnapshot.mockResolvedValue({ status: "success", data: { snapshot: null } });
}

/**
 * A systematic accessibility pass across every modal dialog reachable from
 * CalendarPage: role="dialog" + aria-modal="true" + an accessible name,
 * focus moving inside on open, Escape closing it without triggering any
 * mutation, and — where the dialog's trigger stays mounted throughout —
 * focus returning to that exact trigger afterward.
 */
describe("Calendar modal dialogs — systematic accessibility pass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuccessfulQueries();
  });

  it("create-series dialog: accessible, traps focus, Escape returns focus to its trigger", async () => {
    render(<CalendarPage />);
    const triggers = await screen.findAllByRole("button", { name: /\+ добавить источник/i });
    const trigger = triggers[0];
    await userEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Серия" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Серия" })).not.toBeInTheDocument();
    expect(mockCreateSeries).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("edit-series dialog: accessible, Escape returns focus to its trigger", async () => {
    render(<CalendarPage />);
    const trigger = await screen.findByRole("button", { name: /изменить источник/i });
    await userEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Серия" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Серия" })).not.toBeInTheDocument();
    expect(mockUpdateSeries).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("delete-series-confirm dialog: accessible, focuses its confirm button, Escape cancels without deleting", async () => {
    render(<CalendarPage />);
    const trigger = await screen.findByRole("button", { name: /удалить источник/i });
    await userEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: /удалить серию/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: /^удалить$/i })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /удалить серию/i })).not.toBeInTheDocument();
    expect(mockDeleteSeries).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("edit-scope dialog: accessible, traps focus, Escape returns focus to the day cell that started the flow", async () => {
    render(<CalendarPage />);
    const dayCell = await screen.findByRole("button", { name: /2026-01-15/ });
    await userEvent.click(dayCell);
    const daySheet = await screen.findByRole("dialog", { name: /2026-01-15/ });
    await userEvent.click(within(daySheet).getByRole("button", { name: /изменить/i }));

    const scopeDialog = await screen.findByRole("dialog", { name: /область изменения/i });
    expect(scopeDialog).toHaveAttribute("aria-modal", "true");
    expect(scopeDialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /область изменения/i })).not.toBeInTheDocument();
    expect(dayCell).toHaveFocus();
  });

  it("override-occurrence dialog: accessible, traps focus, Escape cancels without mutating", async () => {
    render(<CalendarPage />);
    const dayCell = await screen.findByRole("button", { name: /2026-01-15/ });
    await userEvent.click(dayCell);
    const daySheet = await screen.findByRole("dialog", { name: /2026-01-15/ });
    await userEvent.click(within(daySheet).getByRole("button", { name: /изменить/i }));
    const scopeDialog = await screen.findByRole("dialog", { name: /область изменения/i });
    await userEvent.click(within(scopeDialog).getByText(/только это вхождение/i));

    const overrideDialog = await screen.findByRole("dialog", { name: /изменить это вхождение/i });
    expect(overrideDialog).toHaveAttribute("aria-modal", "true");
    expect(overrideDialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /изменить это вхождение/i })).not.toBeInTheDocument();
    expect(mockUpsertException).not.toHaveBeenCalled();
  });

  it("cancel-occurrence-confirm dialog: accessible, reachable directly from a virtual occurrence's 'Отменить'", async () => {
    render(<CalendarPage />);
    const dayCell = await screen.findByRole("button", { name: /2026-01-15/ });
    await userEvent.click(dayCell);
    const daySheet = await screen.findByRole("dialog", { name: /2026-01-15/ });
    await userEvent.click(within(daySheet).getByRole("button", { name: /отменить/i }));

    const confirmDialog = await screen.findByRole("dialog", { name: /отменить это вхождение/i });
    expect(confirmDialog).toHaveAttribute("aria-modal", "true");
    expect(within(confirmDialog).getByRole("button", { name: /^отменить вхождение$/i })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /отменить это вхождение/i })).not.toBeInTheDocument();
    expect(mockUpsertException).not.toHaveBeenCalled();
  });

  it("split-series dialog: accessible and traps focus", async () => {
    render(<CalendarPage />);
    const dayCell = await screen.findByRole("button", { name: /2026-01-15/ });
    await userEvent.click(dayCell);
    const daySheet = await screen.findByRole("dialog", { name: /2026-01-15/ });
    await userEvent.click(within(daySheet).getByRole("button", { name: /изменить/i }));
    const scopeDialog = await screen.findByRole("dialog", { name: /область изменения/i });
    await userEvent.click(within(scopeDialog).getByText(/это и будущие вхождения/i));

    const splitDialog = await screen.findByRole("dialog", { name: /разделить серию/i });
    expect(splitDialog).toHaveAttribute("aria-modal", "true");
    expect(splitDialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /разделить серию/i })).not.toBeInTheDocument();
    expect(mockSplitSeries).not.toHaveBeenCalled();
  });

  it("a day-detail sheet with a nested delete-confirmation: Escape closes only the nested confirm, not the whole sheet", async () => {
    mockFetchOccurrences.mockResolvedValue({
      status: "success",
      data: {
        occurrences: [
          {
            kind: "actual",
            id: "tx-1",
            localDate: "2026-01-15",
            type: TransactionType.INCOME,
            currencyType: CurrencyType.POLYCHROME,
            amount: 300,
            source: IncomeSource.EVENT,
            bannerFamily: null,
            note: null,
            seriesId: null,
            occurrenceDate: null,
            version: 1,
          },
        ],
      },
    });

    render(<CalendarPage />);
    const dayCell = await screen.findByRole("button", { name: /2026-01-15/ });
    await userEvent.click(dayCell);
    const daySheet = await screen.findByRole("dialog", { name: /2026-01-15/ });
    await userEvent.click(within(daySheet).getByRole("button", { name: /удалить/i }));

    const deleteConfirm = await screen.findByRole("dialog", { name: /удалить операцию/i });
    await userEvent.keyboard("{Escape}");

    // The nested confirm closes...
    expect(screen.queryByRole("dialog", { name: /удалить операцию/i })).not.toBeInTheDocument();
    // ...but the day-detail sheet underneath is still open (Escape wasn't
    // double-handled by both the sheet's own trap and the nested dialog's).
    expect(screen.getByRole("dialog", { name: /2026-01-15/ })).toBeInTheDocument();
    expect(deleteConfirm).not.toBeInTheDocument();
  });
});
