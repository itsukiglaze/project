import type { BannerFamily } from "@/config/gacha";
import type { CurrencyType, IncomeSource, LocalDate, TransactionType } from "@/lib/calendar-math";
import { formatLocalDate } from "@/lib/calendar-math";

export type CurrencyAmountDto = { currency: CurrencyType; amount: number };
export type SourceCurrencyAmountDto = { source: IncomeSource; currency: CurrencyType; amount: number };
export type BannerPullCountDto = { bannerFamily: BannerFamily; currency: CurrencyType; pulls: number };
export type TransactionTypeCurrencyAmountDto = { type: TransactionType; currency: CurrencyType; amount: number };

export type StatisticsBucketTotalsDto = {
  incomeTotals: CurrencyAmountDto[];
  expenseTotals: CurrencyAmountDto[];
  pullTotals: BannerPullCountDto[];
  netFlowPolychrome: number;
};

export type StatisticsTimelinePointDto = {
  date: string; // "YYYY-MM-DD"
  actualIncomePolychrome: number;
  actualExpensePolychrome: number;
  actualPulls: number;
  actualCumulativeNetPolychrome: number | null;
  scheduledIncomePolychrome: number;
  scheduledExpensePolychrome: number;
  scheduledPulls: number;
  projectedCumulativeNetPolychrome: number | null;
};

export type StatisticsOverviewDto = {
  range: { from: string; to: string; today: string; timezone: string };
  actual: StatisticsBucketTotalsDto;
  scheduled: StatisticsBucketTotalsDto;
  expectedRangeTotal: {
    income: CurrencyAmountDto[];
    expense: CurrencyAmountDto[];
    pulls: BannerPullCountDto[];
    netFlowPolychrome: number;
  };
  timeline: StatisticsTimelinePointDto[];
  breakdowns: {
    bySource: SourceCurrencyAmountDto[];
    byBannerFamily: BannerPullCountDto[];
    byTransactionType: TransactionTypeCurrencyAmountDto[];
  };
};

// ---------------------------------------------------------------------------
// Shared result / fetch plumbing — mirrors features/calendar/api.ts and
// features/profile/api.ts.
// ---------------------------------------------------------------------------

export type StatisticsApiResult<T> =
  | { status: "success"; data: T }
  | { status: "auth_error"; message: string }
  | { status: "validation_error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "network_error" }
  | { status: "unknown_error"; message: string };

type ApiErrorBody = {
  error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> };
};

async function handleResponse<T>(
  response: Response,
  isExpectedShape: (value: unknown) => value is T,
): Promise<StatisticsApiResult<T>> {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { status: "unknown_error", message: "Сервер вернул некорректный ответ." };
  }

  if (!response.ok) {
    const body = json as ApiErrorBody;
    if (response.status === 401) {
      return { status: "auth_error", message: body.error?.message ?? "Требуется вход через Telegram." };
    }
    if (response.status === 400) {
      return {
        status: "validation_error",
        message: body.error?.message ?? "Проверьте переданные данные.",
        fieldErrors: body.error?.fieldErrors,
      };
    }
    return { status: "unknown_error", message: body.error?.message ?? "Внутренняя ошибка сервера." };
  }

  if (!isExpectedShape(json)) {
    return { status: "unknown_error", message: "Неожиданный формат ответа сервера." };
  }
  return { status: "success", data: json };
}

async function request<T>(
  input: RequestInfo,
  init: RequestInit,
  isExpectedShape: (value: unknown) => value is T,
): Promise<StatisticsApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, { credentials: "same-origin", ...init });
  } catch {
    return { status: "network_error" };
  }
  return handleResponse(response, isExpectedShape);
}

function isStatisticsOverview(value: unknown): value is StatisticsOverviewDto {
  return (
    typeof value === "object" &&
    value !== null &&
    "range" in value &&
    "actual" in value &&
    "scheduled" in value &&
    "expectedRangeTotal" in value &&
    "timeline" in value &&
    "breakdowns" in value
  );
}

export async function fetchStatisticsOverview(
  from: LocalDate,
  to: LocalDate,
): Promise<StatisticsApiResult<StatisticsOverviewDto>> {
  const params = new URLSearchParams({ from: formatLocalDate(from), to: formatLocalDate(to) });
  return request(`/api/statistics/overview?${params.toString()}`, { method: "GET" }, isStatisticsOverview);
}
