// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { invalidateQueryKeys } from "./query-cache";
import { useQuery } from "./use-query";

describe("useQuery", () => {
  it("starts in a loading state and resolves to success", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: "success", data: { value: 1 } });
    const { result } = renderHook(() => useQuery("key-1", fetcher));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("success"));
    if (result.current.status === "success") {
      expect(result.current.data).toEqual({ value: 1 });
    }
  });

  it("resolves to an error state on a non-success result", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: "network_error" });
    const { result } = renderHook(() => useQuery("key-2", fetcher));

    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status === "error") {
      expect(result.current.result.status).toBe("network_error");
    }
  });

  it("refetch() re-invokes the fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: "success", data: { value: 1 } });
    const { result } = renderHook(() => useQuery("key-3", fetcher));
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => result.current.refetch());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("re-fetches when invalidateQueryKeys matches its key's prefix (targeted invalidation)", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: "success", data: { value: 1 } });
    renderHook(() => useQuery("occurrences:2026-01-01:2026-01-31", fetcher));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    act(() => invalidateQueryKeys("occurrences:"));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("does not re-fetch for an unrelated invalidation prefix", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: "success", data: { value: 1 } });
    renderHook(() => useQuery("series:list", fetcher));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    act(() => invalidateQueryKeys("occurrences:"));
    // Give any (incorrect) async refetch a chance to fire before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("re-fetches when the query key itself changes", async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: "success", data: { value: 1 } });
    const { rerender } = renderHook(({ key }) => useQuery(key, fetcher), {
      initialProps: { key: "key-a" },
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    rerender({ key: "key-b" });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});
