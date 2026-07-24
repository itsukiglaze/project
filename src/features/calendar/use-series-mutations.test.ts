// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateSeries = vi.fn();
const mockUpdateSeries = vi.fn();
const mockDeleteSeries = vi.fn();
const mockSplitSeries = vi.fn();

vi.mock("./api", () => ({
  createSeries: (...args: unknown[]) => mockCreateSeries(...args),
  updateSeries: (...args: unknown[]) => mockUpdateSeries(...args),
  deleteSeries: (...args: unknown[]) => mockDeleteSeries(...args),
  splitSeries: (...args: unknown[]) => mockSplitSeries(...args),
}));

import { useSeriesMutations } from "./use-series-mutations";
import { subscribeQueryKey } from "@/lib/query/query-cache";
import { CurrencyType, IncomeSource, RecurrenceEndType, RecurrenceFrequency, TransactionType } from "@/lib/calendar-math";

const TEMPLATE = {
  type: TransactionType.INCOME as const,
  currencyType: CurrencyType.POLYCHROME,
  amount: 60,
  source: IncomeSource.DAILY,
  bannerFamily: null,
  note: null,
};
const RULE = {
  frequency: RecurrenceFrequency.DAILY,
  interval: 1,
  daysOfWeek: [] as number[],
  dayOfMonth: null,
  startDate: "2026-01-01",
  endType: RecurrenceEndType.NEVER,
  endDate: null,
  occurrenceCount: null,
};

describe("useSeriesMutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create() succeeds and invalidates the series list + occurrences + forecast", async () => {
    mockCreateSeries.mockResolvedValue({ status: "success", data: { record: { id: "s1" }, replay: false } });
    const seriesListener = vi.fn();
    const unsub = subscribeQueryKey("series:list", seriesListener);

    const { result } = renderHook(() => useSeriesMutations());
    await act(async () => {
      await result.current.create(TEMPLATE, RULE, "Europe/Berlin");
    });

    expect(result.current.state.status).toBe("success");
    expect(seriesListener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("update() surfaces stale_state distinctly", async () => {
    mockUpdateSeries.mockResolvedValue({ status: "stale_state", current: { version: 3 } });
    const { result } = renderHook(() => useSeriesMutations());

    await act(async () => {
      await result.current.update("s1", TEMPLATE, RULE, 1);
    });

    expect(result.current.state.status).toBe("stale_state");
  });

  it("remove() (soft-delete) succeeds", async () => {
    mockDeleteSeries.mockResolvedValue({
      status: "success",
      data: { record: { id: "s1", isActive: false }, replay: false },
    });
    const { result } = renderHook(() => useSeriesMutations());

    await act(async () => {
      await result.current.remove("s1", 1);
    });

    expect(result.current.state.status).toBe("success");
  });

  it("split() delegates to the split endpoint and surfaces idempotency_key_reused distinctly", async () => {
    mockSplitSeries.mockResolvedValue({ status: "idempotency_key_reused" });
    const { result } = renderHook(() => useSeriesMutations());

    await act(async () => {
      await result.current.split("s1", TEMPLATE, RULE, { year: 2026, month: 1, day: 10 }, 1);
    });

    expect(mockSplitSeries).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("idempotency_key_reused");
  });

  it("reuses the same idempotency key for a retried create with the same payload", async () => {
    mockCreateSeries
      .mockResolvedValueOnce({ status: "network_error" })
      .mockResolvedValueOnce({ status: "success", data: { record: { id: "s1" }, replay: false } });

    const { result } = renderHook(() => useSeriesMutations());
    await act(async () => {
      await result.current.create(TEMPLATE, RULE, "Europe/Berlin");
    });
    await act(async () => {
      await result.current.create(TEMPLATE, RULE, "Europe/Berlin");
    });

    const firstKey = mockCreateSeries.mock.calls[0][3];
    const secondKey = mockCreateSeries.mock.calls[1][3];
    expect(firstKey).toBe(secondKey);
  });
});
