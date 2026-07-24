// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsertException = vi.fn();

vi.mock("./api", () => ({
  upsertException: (...args: unknown[]) => mockUpsertException(...args),
}));

import { useExceptionMutation } from "./use-exception-mutation";

const DATE = { year: 2026, month: 1, day: 5 };
const CANCEL_INPUT = {
  isCancelled: true,
  amountOverride: null,
  currencyTypeOverride: null,
  sourceOverride: null,
  bannerFamilyOverride: null,
  noteOverride: null,
};

describe("useExceptionMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds on the first attempt when the guessed version is correct", async () => {
    mockUpsertException.mockResolvedValue({ status: "success", data: { record: {}, replay: false } });
    const { result } = renderHook(() => useExceptionMutation());

    await act(async () => {
      await result.current.upsert("series-1", DATE, CANCEL_INPUT, 0);
    });

    expect(result.current.state.status).toBe("success");
    expect(mockUpsertException).toHaveBeenCalledTimes(1);
  });

  it("auto-retries once with the server-reported version when the guessed expectedVersion=0 was wrong", async () => {
    mockUpsertException
      .mockResolvedValueOnce({ status: "stale_state", current: { version: 3 } })
      .mockResolvedValueOnce({ status: "success", data: { record: {}, replay: false } });

    const { result } = renderHook(() => useExceptionMutation());

    await act(async () => {
      await result.current.upsert("series-1", DATE, CANCEL_INPUT, 0);
    });

    expect(result.current.state.status).toBe("success");
    expect(mockUpsertException).toHaveBeenCalledTimes(2);
    // Second call used the corrected version (3), not the original guess (0).
    expect(mockUpsertException.mock.calls[1][3]).toBe(3);
  });

  it("reuses the exact same idempotency key for both the initial guess and the auto-corrected retry", async () => {
    mockUpsertException
      .mockResolvedValueOnce({ status: "stale_state", current: { version: 3 } })
      .mockResolvedValueOnce({ status: "success", data: { record: {}, replay: false } });

    const { result } = renderHook(() => useExceptionMutation());
    await act(async () => {
      await result.current.upsert("series-1", DATE, CANCEL_INPUT, 0);
    });

    const firstCallKey = mockUpsertException.mock.calls[0][4];
    const secondCallKey = mockUpsertException.mock.calls[1][4];
    expect(firstCallKey).toBe(secondCallKey);
  });

  it("retries at most once — a SECOND conflict on the retry is surfaced, not hidden or retried again", async () => {
    mockUpsertException
      .mockResolvedValueOnce({ status: "stale_state", current: { version: 3 } })
      .mockResolvedValueOnce({ status: "stale_state", current: { version: 7 } }); // still stale after the retry

    const { result } = renderHook(() => useExceptionMutation());
    await act(async () => {
      await result.current.upsert("series-1", DATE, CANCEL_INPUT, 0);
    });

    // Exactly 2 calls total — no third attempt, no infinite loop.
    expect(mockUpsertException).toHaveBeenCalledTimes(2);
    // The FINAL (second) conflict is what's exposed to the UI.
    expect(result.current.state.status).toBe("stale_state");
    if (result.current.state.status === "stale_state") {
      expect((result.current.state.current as { version: number }).version).toBe(7);
    }
  });

  it("does not auto-retry when expectedVersion was NOT a guess (non-zero) — the conflict is surfaced as-is", async () => {
    mockUpsertException.mockResolvedValue({ status: "stale_state", current: { version: 9 } });
    const { result } = renderHook(() => useExceptionMutation());

    await act(async () => {
      await result.current.upsert("series-1", DATE, CANCEL_INPUT, 2);
    });

    expect(mockUpsertException).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("stale_state");
  });

  it("surfaces idempotency_key_reused distinctly", async () => {
    mockUpsertException.mockResolvedValue({ status: "idempotency_key_reused" });
    const { result } = renderHook(() => useExceptionMutation());

    await act(async () => {
      await result.current.upsert("series-1", DATE, CANCEL_INPUT, 0);
    });

    expect(result.current.state.status).toBe("idempotency_key_reused");
  });
});
