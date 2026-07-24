// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateTransaction = vi.fn();
const mockUpdateTransaction = vi.fn();
const mockDeleteTransaction = vi.fn();

vi.mock("./api", () => ({
  createTransaction: (...args: unknown[]) => mockCreateTransaction(...args),
  updateTransaction: (...args: unknown[]) => mockUpdateTransaction(...args),
  deleteTransaction: (...args: unknown[]) => mockDeleteTransaction(...args),
}));

import { useTransactionMutations } from "./use-transaction-mutations";
import { subscribeQueryKey } from "./query-cache";
import { CurrencyType, IncomeSource, TransactionType } from "@/lib/calendar-math";

const INPUT = {
  localDate: "2026-01-05",
  type: TransactionType.INCOME,
  currencyType: CurrencyType.POLYCHROME,
  amount: 300,
  source: IncomeSource.EVENT,
  bannerFamily: null,
  note: null,
  timezone: "Europe/Berlin",
};

describe("useTransactionMutations", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("create() succeeds and invalidates the occurrences/forecast queries", async () => {
    mockCreateTransaction.mockResolvedValue({
      status: "success",
      data: { record: { id: "tx-1" }, replay: false },
    });
    const occurrencesListener = vi.fn();
    const unsub = subscribeQueryKey("occurrences:2026-01-01:2026-01-31", occurrencesListener);

    const { result } = renderHook(() => useTransactionMutations());
    await act(async () => {
      await result.current.create(INPUT);
    });

    expect(result.current.state.status).toBe("success");
    expect(occurrencesListener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("surfaces a stale_state result distinctly", async () => {
    mockUpdateTransaction.mockResolvedValue({ status: "stale_state", current: { version: 4 } });
    const { result } = renderHook(() => useTransactionMutations());

    await act(async () => {
      await result.current.update("tx-1", INPUT, 1);
    });

    expect(result.current.state.status).toBe("stale_state");
    if (result.current.state.status === "stale_state") {
      expect((result.current.state.current as { version: number }).version).toBe(4);
    }
  });

  it("surfaces an idempotency_key_reused result distinctly", async () => {
    mockDeleteTransaction.mockResolvedValue({ status: "idempotency_key_reused" });
    const { result } = renderHook(() => useTransactionMutations());

    await act(async () => {
      await result.current.remove("tx-1", 1);
    });

    expect(result.current.state.status).toBe("idempotency_key_reused");
  });

  it("reuses the same idempotency key across a failed retry with the same payload", async () => {
    mockCreateTransaction
      .mockResolvedValueOnce({ status: "network_error" })
      .mockResolvedValueOnce({ status: "success", data: { record: { id: "tx-1" }, replay: false } });

    const { result } = renderHook(() => useTransactionMutations());

    await act(async () => {
      await result.current.create(INPUT);
    });
    expect(result.current.state.status).toBe("network_error");

    await act(async () => {
      await result.current.create(INPUT); // retry, identical payload
    });
    expect(result.current.state.status).toBe("success");

    const firstKey = mockCreateTransaction.mock.calls[0][1];
    const secondKey = mockCreateTransaction.mock.calls[1][1];
    expect(firstKey).toBe(secondKey);
  });

  it("mints a new idempotency key when the payload changes before retrying", async () => {
    mockCreateTransaction.mockResolvedValue({ status: "network_error" });
    const { result } = renderHook(() => useTransactionMutations());

    await act(async () => {
      await result.current.create(INPUT);
    });
    await act(async () => {
      await result.current.create({ ...INPUT, amount: 999 }); // different payload
    });

    const firstKey = mockCreateTransaction.mock.calls[0][1];
    const secondKey = mockCreateTransaction.mock.calls[1][1];
    expect(firstKey).not.toBe(secondKey);
  });
});
