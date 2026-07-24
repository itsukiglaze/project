"use client";

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

/** Subscribes to a stable query key; returns an unsubscribe function. */
export function subscribeQueryKey(key: string, listener: Listener): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(listener);
  return () => {
    listeners.get(key)?.delete(listener);
  };
}

/**
 * Invalidates every currently-subscribed query whose key starts with
 * `keyOrPrefix` — e.g. `invalidateQueryKeys("occurrences:")` refetches
 * every mounted month/day view regardless of its specific date range,
 * without needing to know each one's exact key.
 */
export function invalidateQueryKeys(keyOrPrefix: string): void {
  for (const [key, keyListeners] of listeners.entries()) {
    if (key.startsWith(keyOrPrefix)) {
      keyListeners.forEach((listener) => listener());
    }
  }
}

export const CALENDAR_QUERY_KEYS = {
  occurrences: (from: string, to: string) => `occurrences:${from}:${to}`,
  occurrencesPrefix: "occurrences:",
  forecast: (days: number) => `forecast:${days}`,
  forecastPrefix: "forecast:",
  seriesList: "series:list",
};
