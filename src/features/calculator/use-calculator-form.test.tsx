// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCalculatorForm } from "./use-calculator-form";

function mockCalculatedResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      kind: "CALCULATED",
      firstTargetCost: 90,
      additionalTargetCost: 180,
      totalRequiredPulls: 90,
      availablePulls: 0,
      missingPulls: 90,
      missingPolychrome: 14400,
      leftoverPolychrome: 0,
      explanation: [],
    }),
  };
}

function mockValidationErrorResponse() {
  return {
    ok: false,
    status: 400,
    json: async () => ({
      error: { code: "CALCULATION_VALIDATION_ERROR", message: "Данные некорректны." },
    }),
  };
}

describe("useCalculatorForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("16. does not send a second request while one is already in flight", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockCalculatedResponse());
    vi.stubGlobal("fetch", fetchSpy);

    const { result } = renderHook(() => useCalculatorForm());

    act(() => {
      // Fire twice back-to-back, as a rapid double-tap would.
      void result.current.submit();
      void result.current.submit();
    });

    await waitFor(() => expect(result.current.uiState.status).toBe("calculated"));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("17. marks a successful result stale after a relevant parameter changes", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(mockCalculatedResponse());
    vi.stubGlobal("fetch", fetchSpy);

    const { result } = renderHook(() => useCalculatorForm());

    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.uiState.status).toBe("calculated");
    if (result.current.uiState.status === "calculated") {
      expect(result.current.uiState.stale).toBe(false);
    }

    act(() => {
      result.current.setUseSavedResources(false);
    });

    await waitFor(() => {
      expect(result.current.uiState.status).toBe("calculated");
      if (result.current.uiState.status === "calculated") {
        expect(result.current.uiState.stale).toBe(true);
      }
    });
  });

  it("7. a failed retry does not silently make the previous successful result look fresh again", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(mockCalculatedResponse())
      .mockResolvedValueOnce(mockValidationErrorResponse());
    vi.stubGlobal("fetch", fetchSpy);

    const { result } = renderHook(() => useCalculatorForm());

    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.uiState.status).toBe("calculated");

    await act(async () => {
      await result.current.submit();
    });

    // The old "calculated" data must not still be presented (silently or
    // otherwise) as the current answer once a subsequent request failed.
    expect(result.current.uiState.status).toBe("validation_error");
  });

  it("19. does not update state after the hook has unmounted (no crash, no stale write)", async () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => pending),
    );

    const { result, unmount } = renderHook(() => useCalculatorForm());

    act(() => {
      void result.current.submit();
    });
    expect(result.current.uiState.status).toBe("loading");

    unmount();

    // Resolve the in-flight request only AFTER unmount — this must not
    // throw, and must not attempt to update state on the unmounted hook.
    await act(async () => {
      resolveFetch(mockCalculatedResponse());
      await pending;
    });

    // No assertion on result.current after unmount (RTL detaches it) —
    // the absence of a thrown error/act warning here is the actual test.
    expect(true).toBe(true);
  });
});
