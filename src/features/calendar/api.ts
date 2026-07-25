import type { LocalDate } from "@/lib/calendar-math";
import { formatLocalDate } from "@/lib/calendar-math";

// The canonical wire-format DTOs live in src/lib/api/calendar-dto.ts — one
// definition shared by the server routes (which serialize into this exact
// shape) and this client module, so the two can never independently drift
// out of sync the way they did before (see that file's own docs for the
// LocalDate-serialization bug this fixed).
import type {
  ExceptionInputDto,
  ExceptionRecordDto,
  ForecastDto,
  MergedOccurrenceDto,
  RecurrenceRuleDto,
  SeriesRecordDto,
  SeriesTemplateDto,
  TransactionInputDto,
  TransactionRecordDto,
} from "@/lib/api/calendar-dto";
export type {
  RecurrenceRuleDto,
  SeriesTemplateDto,
  SeriesRecordDto,
  ExceptionInputDto,
  ExceptionRecordDto,
  TransactionInputDto,
  TransactionRecordDto,
  MergedOccurrenceDto,
  ForecastDto,
} from "@/lib/api/calendar-dto";

// ---------------------------------------------------------------------------
// Shared result / fetch plumbing — mirrors features/profile/api.ts and
// features/calculator/api.ts, extended with the extra error kinds Stage 5C
// endpoints can return (NOT_FOUND, INVALID_OCCURRENCE).
// ---------------------------------------------------------------------------

export type CalendarApiResult<T> =
  | { status: "success"; data: T }
  | { status: "auth_error"; message: string }
  | { status: "validation_error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "not_found" }
  | { status: "stale_state"; current: unknown }
  | { status: "idempotency_key_reused" }
  | { status: "invalid_occurrence"; errors: string[] }
  | { status: "network_error" }
  | { status: "unknown_error"; message: string };

type ApiErrorBody = {
  error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> };
  current?: unknown;
};

async function handleResponse<T>(
  response: Response,
  isExpectedShape: (value: unknown) => value is T,
): Promise<CalendarApiResult<T>> {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { status: "unknown_error", message: "Сервер вернул некорректный ответ." };
  }

  if (!response.ok) {
    const body = json as ApiErrorBody;
    const code = body.error?.code;
    if (response.status === 401) {
      return { status: "auth_error", message: body.error?.message ?? "Требуется вход через Telegram." };
    }
    if (response.status === 404) {
      return { status: "not_found" };
    }
    if (response.status === 409 && code === "STALE_STATE") {
      return { status: "stale_state", current: body.current };
    }
    if (response.status === 409 && code === "IDEMPOTENCY_KEY_REUSED") {
      return { status: "idempotency_key_reused" };
    }
    if (response.status === 422) {
      return {
        status: "invalid_occurrence",
        errors: (body.error?.fieldErrors?.input as string[] | undefined) ?? [
          body.error?.message ?? "Некорректное вхождение.",
        ],
      };
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
): Promise<CalendarApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, { credentials: "same-origin", ...init });
  } catch {
    return { status: "network_error" };
  }
  return handleResponse(response, isExpectedShape);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function hasOkTrue(value: unknown): value is { ok: true } & Record<string, unknown> {
  return isObject(value) && value.ok === true;
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

export type SeriesMutationResult = { ok: true; record: SeriesRecordDto; replay: boolean };
export type SplitMutationResult =
  | { ok: true; mode: "IN_PLACE_EDIT"; record: SeriesRecordDto; replay: boolean }
  | {
      ok: true;
      mode: "SPLIT";
      oldSeries: SeriesRecordDto;
      newSeries: SeriesRecordDto;
      reassignedExceptionCount: number;
      replay: boolean;
    };

export async function fetchSeriesList(): Promise<CalendarApiResult<{ series: SeriesRecordDto[] }>> {
  return request(
    "/api/calendar/series",
    { method: "GET" },
    (v): v is { series: SeriesRecordDto[] } => isObject(v) && Array.isArray(v.series),
  );
}

export async function createSeries(
  template: SeriesTemplateDto,
  rule: RecurrenceRuleDto,
  timezone: string,
  idempotencyKey: string,
): Promise<CalendarApiResult<SeriesMutationResult>> {
  return request(
    "/api/calendar/series",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...template, rule, timezone, idempotencyKey }),
    },
    hasOkTrue as (v: unknown) => v is SeriesMutationResult,
  );
}

export async function updateSeries(
  seriesId: string,
  template: SeriesTemplateDto,
  rule: RecurrenceRuleDto,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<CalendarApiResult<SeriesMutationResult>> {
  return request(
    `/api/calendar/series/${seriesId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...template, rule, expectedVersion, idempotencyKey }),
    },
    hasOkTrue as (v: unknown) => v is SeriesMutationResult,
  );
}

export async function deleteSeries(
  seriesId: string,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<CalendarApiResult<SeriesMutationResult>> {
  return request(
    `/api/calendar/series/${seriesId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion, idempotencyKey }),
    },
    hasOkTrue as (v: unknown) => v is SeriesMutationResult,
  );
}

export async function splitSeries(
  seriesId: string,
  template: SeriesTemplateDto,
  rule: RecurrenceRuleDto,
  splitDate: LocalDate,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<CalendarApiResult<SplitMutationResult>> {
  return request(
    `/api/calendar/series/${seriesId}/split`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...template,
        rule,
        splitDate: formatLocalDate(splitDate),
        expectedVersion,
        idempotencyKey,
      }),
    },
    hasOkTrue as (v: unknown) => v is SplitMutationResult,
  );
}

// ---------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------

export type ExceptionMutationResult = { ok: true; record: ExceptionRecordDto; replay: boolean };

export async function upsertException(
  seriesId: string,
  occurrenceDate: LocalDate,
  input: ExceptionInputDto,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<CalendarApiResult<ExceptionMutationResult>> {
  return request(
    `/api/calendar/series/${seriesId}/exceptions/${formatLocalDate(occurrenceDate)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, expectedVersion, idempotencyKey }),
    },
    hasOkTrue as (v: unknown) => v is ExceptionMutationResult,
  );
}

// ---------------------------------------------------------------------------
// One-time transactions
// ---------------------------------------------------------------------------

export type TransactionMutationResult = { ok: true; record: TransactionRecordDto; replay: boolean };

export async function createTransaction(
  input: TransactionInputDto,
  idempotencyKey: string,
): Promise<CalendarApiResult<TransactionMutationResult>> {
  return request(
    "/api/calendar/transactions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, idempotencyKey }),
    },
    hasOkTrue as (v: unknown) => v is TransactionMutationResult,
  );
}

export async function updateTransaction(
  transactionId: string,
  input: TransactionInputDto,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<CalendarApiResult<TransactionMutationResult>> {
  return request(
    `/api/calendar/transactions/${transactionId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, expectedVersion, idempotencyKey }),
    },
    hasOkTrue as (v: unknown) => v is TransactionMutationResult,
  );
}

export async function deleteTransaction(
  transactionId: string,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<CalendarApiResult<TransactionMutationResult>> {
  return request(
    `/api/calendar/transactions/${transactionId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion, idempotencyKey }),
    },
    hasOkTrue as (v: unknown) => v is TransactionMutationResult,
  );
}

// ---------------------------------------------------------------------------
// Read-only
// ---------------------------------------------------------------------------

export async function fetchOccurrences(
  from: LocalDate,
  to: LocalDate,
): Promise<CalendarApiResult<{ occurrences: MergedOccurrenceDto[] }>> {
  const params = new URLSearchParams({ from: formatLocalDate(from), to: formatLocalDate(to) });
  return request(
    `/api/calendar/occurrences?${params.toString()}`,
    { method: "GET" },
    (v): v is { occurrences: MergedOccurrenceDto[] } => isObject(v) && Array.isArray(v.occurrences),
  );
}

export async function fetchForecast(days: number): Promise<CalendarApiResult<ForecastDto>> {
  const params = new URLSearchParams({ days: String(days) });
  return request(
    `/api/calendar/forecast?${params.toString()}`,
    { method: "GET" },
    (v): v is ForecastDto => isObject(v) && Array.isArray(v.occurrences) && Array.isArray(v.dailyBalances),
  );
}
