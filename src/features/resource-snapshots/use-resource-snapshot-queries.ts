"use client";

import type { LocalDate } from "@/lib/calendar-math";
import { formatLocalDate } from "@/lib/calendar-math";
import { useQuery } from "@/lib/query/use-query";
import { fetchLatestSnapshot, fetchSnapshotHistory } from "./api";
import { RESOURCE_SNAPSHOT_QUERY_KEYS } from "./query-cache";

/**
 * `enabled` gates the fetch — pass `useAuth().status === "authenticated"`
 * from the caller, same reasoning as the calculator/calendar features'
 * own `enabled` gates on `useQuery`: firing on mount regardless can race
 * the session cookie being set and come back a false 401.
 */
export function useLatestSnapshotQuery(enabled = true) {
  return useQuery(RESOURCE_SNAPSHOT_QUERY_KEYS.latest, () => fetchLatestSnapshot(), enabled);
}

export function useSnapshotHistoryQuery(from: LocalDate, to: LocalDate, enabled = true) {
  const key = RESOURCE_SNAPSHOT_QUERY_KEYS.history(formatLocalDate(from), formatLocalDate(to));
  return useQuery(key, () => fetchSnapshotHistory(from, to), enabled);
}
