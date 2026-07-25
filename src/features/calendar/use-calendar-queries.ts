"use client";

import type { LocalDate } from "@/lib/calendar-math";
import { formatLocalDate } from "@/lib/calendar-math";
import { useQuery } from "@/lib/query/use-query";
import { fetchForecast, fetchOccurrences, fetchSeriesList } from "./api";
import { CALENDAR_QUERY_KEYS } from "./query-cache";

export function useOccurrencesQuery(from: LocalDate, to: LocalDate, enabled = true) {
  const key = CALENDAR_QUERY_KEYS.occurrences(formatLocalDate(from), formatLocalDate(to));
  return useQuery(key, () => fetchOccurrences(from, to), enabled);
}

export function useForecastQuery(days: number, enabled = true) {
  const key = CALENDAR_QUERY_KEYS.forecast(days);
  return useQuery(key, () => fetchForecast(days), enabled);
}

export function useSeriesListQuery(enabled = true) {
  return useQuery(CALENDAR_QUERY_KEYS.seriesList, () => fetchSeriesList(), enabled);
}
