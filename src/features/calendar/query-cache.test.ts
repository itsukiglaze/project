import { describe, expect, it, vi } from "vitest";
import { CALENDAR_QUERY_KEYS, invalidateQueryKeys, subscribeQueryKey } from "./query-cache";

describe("query-cache", () => {
  it("notifies a subscriber for an exact key match", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeQueryKey("occurrences:2026-01-01:2026-01-31", listener);
    invalidateQueryKeys("occurrences:2026-01-01:2026-01-31");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("notifies every subscriber whose key starts with the given prefix (targeted invalidation)", () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const unsubA = subscribeQueryKey("occurrences:2026-01-01:2026-01-31", listenerA);
    const unsubB = subscribeQueryKey("occurrences:2026-02-01:2026-02-28", listenerB);

    invalidateQueryKeys(CALENDAR_QUERY_KEYS.occurrencesPrefix);

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
    unsubA();
    unsubB();
  });

  it("does NOT notify a subscriber whose key does not match the prefix", () => {
    const occurrencesListener = vi.fn();
    const seriesListener = vi.fn();
    const unsub1 = subscribeQueryKey("occurrences:2026-01-01:2026-01-31", occurrencesListener);
    const unsub2 = subscribeQueryKey(CALENDAR_QUERY_KEYS.seriesList, seriesListener);

    invalidateQueryKeys(CALENDAR_QUERY_KEYS.occurrencesPrefix);

    expect(occurrencesListener).toHaveBeenCalledTimes(1);
    expect(seriesListener).not.toHaveBeenCalled();
    unsub1();
    unsub2();
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeQueryKey("series:list", listener);
    unsubscribe();
    invalidateQueryKeys("series:list");
    expect(listener).not.toHaveBeenCalled();
  });

  it("query key builders produce the expected stable strings", () => {
    expect(CALENDAR_QUERY_KEYS.occurrences("2026-01-01", "2026-01-31")).toBe(
      "occurrences:2026-01-01:2026-01-31",
    );
    expect(CALENDAR_QUERY_KEYS.forecast(30)).toBe("forecast:30");
  });
});
