"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarApiResult } from "./api";
import { subscribeQueryKey } from "./query-cache";

export type QueryState<T> =
  | { status: "loading" }
  | { status: "error"; result: Exclude<CalendarApiResult<T>, { status: "success" }> }
  | { status: "success"; data: T };

/**
 * Fetches `fetcher()` on mount and whenever `queryKey` changes, and
 * re-fetches whenever something calls `invalidateQueryKeys` with a prefix
 * matching `queryKey` (see query-cache.ts). Read-only — never mutates
 * anything itself.
 *
 * Deliberately does NOT reset to a "loading" state on a background
 * refetch/invalidation — the previous data/error stays visible until the
 * new result resolves (stale-while-revalidate), which also means `load`
 * never needs to call `setState` synchronously at its own top: state is
 * only ever set inside the resolved-promise callback, never directly in
 * the effect body itself.
 */
export function useCalendarQuery<T>(
  queryKey: string,
  fetcher: () => Promise<CalendarApiResult<T>>,
): QueryState<T> & { refetch: () => void } {
  const [state, setState] = useState<QueryState<T>>({ status: "loading" });
  const isMountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);

  // Keeps the ref pointing at the latest fetcher without ever touching it
  // during render (refs must only be read/written outside of render).
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const load = useCallback(() => {
    fetcherRef.current().then((result) => {
      if (!isMountedRef.current) return;
      if (result.status === "success") {
        setState({ status: "success", data: result.data });
      } else {
        setState({ status: "error", result });
      }
    });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    load();
    const unsubscribe = subscribeQueryKey(queryKey, load);
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [queryKey, load]);

  return { ...state, refetch: load };
}
