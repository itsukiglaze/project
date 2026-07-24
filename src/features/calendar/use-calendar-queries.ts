"use client";

import type { LocalDate } from "@/lib/calendar-math";
import { formatLocalDate } from "@/lib/calendar-math";
import { fetchForecast, fetchOccurrences, fetchSeriesList } from "./api";
import { CALENDAR_QUERY_KEYS } from "./query-cache";
import { useCalendarQuery } from "./use-calendar-query";

export function useOccurrencesQuery(from: LocalDate, to: LocalDate) {
  const key = CALENDAR_QUERY_KEYS.occurrences(formatLocalDate(from), formatLocalDate(to));
  return useCalendarQuery(key, () => fetchOccurrences(from, to));
}

export function useForecastQuery(days: number) {
  const key = CALENDAR_QUERY_KEYS.forecast(days);
  return useCalendarQuery(key, () => fetchForecast(days));
}

export function useSeriesListQuery() {
  return useCalendarQuery(CALENDAR_QUERY_KEYS.seriesList, () => fetchSeriesList());
}
