"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeQueryKey } from "./query-cache";

export type QueryState<T, TErrorResult = unknown> =
  | { status: "loading" }
  | { status: "error"; result: TErrorResult }
  | { status: "success"; data: T };

/** Extracts the `data` type from a discriminated-union API result's success branch. */
type SuccessData<TFetchResult> = TFetchResult extends { status: "success"; data: infer D } ? D : never;

/**
 * Fetches `fetcher()` on mount and whenever `queryKey` changes, and
 * re-fetches whenever something calls `invalidateQueryKeys` with a prefix
 * matching `queryKey` (see query-cache.ts). Read-only — never mutates
 * anything itself.
 *
 * Generic over whatever discriminated-union result type `fetcher` resolves
 * to (e.g. a feature's own `FooApiResult<T>`) — the success data type and
 * the error-branch type are both inferred from it, so callers don't need to
 * restate either.
 *
 * Deliberately does NOT reset to a "loading" state on a background
 * refetch/invalidation — the previous data/error stays visible until the
 * new result resolves (stale-while-revalidate), which also means `load`
 * never needs to call `setState` synchronously at its own top: state is
 * only ever set inside the resolved-promise callback.
 *
 * `enabled` (default true) gates the actual fetch. Pass `false` while a
 * prerequisite (e.g. auth) hasn't resolved yet — firing immediately on
 * mount regardless can race a session cookie still being set and come
 * back 401, which then looks identical to a genuine error and never
 * retries on its own once the prerequisite becomes true. Staying in
 * "loading" until the caller flips `enabled` avoids that false negative.
 */
export function useQuery<TFetchResult extends { status: string }>(
  queryKey: string,
  fetcher: () => Promise<TFetchResult>,
  enabled = true,
): QueryState<SuccessData<TFetchResult>, Exclude<TFetchResult, { status: "success" }>> & {
  refetch: () => void;
} {
  type Data = SuccessData<TFetchResult>;
  type ErrorResult = Exclude<TFetchResult, { status: "success" }>;

  const [state, setState] = useState<QueryState<Data, ErrorResult>>({ status: "loading" });
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
        const success = result as unknown as { status: "success"; data: Data };
        setState({ status: "success", data: success.data });
      } else {
        setState({ status: "error", result: result as ErrorResult });
      }
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    isMountedRef.current = true;
    load();
    const unsubscribe = subscribeQueryKey(queryKey, load);
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [queryKey, load, enabled]);

  return { ...state, refetch: load };
}
