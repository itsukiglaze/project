"use client";

import type { LocalDate } from "@/lib/calendar-math";
import { formatLocalDate } from "@/lib/calendar-math";
import { useQuery } from "@/lib/query/use-query";
import { fetchStatisticsOverview } from "./api";

export function useStatisticsOverviewQuery(from: LocalDate, to: LocalDate) {
  const key = `statistics:overview:${formatLocalDate(from)}:${formatLocalDate(to)}`;
  return useQuery(key, () => fetchStatisticsOverview(from, to));
}
