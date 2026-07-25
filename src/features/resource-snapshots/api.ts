import { formatLocalDate, type LocalDate } from "@/lib/calendar-math";
import type {
  ResourceSnapshotComparisonDto,
  ResourceSnapshotItemDto,
  ResourceSnapshotRecordDto,
} from "@/lib/api/resource-snapshot-dto";

export type {
  ResourceSnapshotComparisonDto,
  ResourceSnapshotItemDto,
  ResourceSnapshotRecordDto,
  CurrencyComparisonDto,
} from "@/lib/api/resource-snapshot-dto";

// ---------------------------------------------------------------------------
// Shared result / fetch plumbing — mirrors features/calendar/api.ts.
// ---------------------------------------------------------------------------

export type SnapshotApiResult<T> =
  | { status: "success"; data: T }
  | { status: "auth_error"; message: string }
  | { status: "validation_error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "not_found" }
  | { status: "stale_state"; current: unknown }
  | { status: "idempotency_key_reused" }
  | { status: "network_error" }
  | { status: "unknown_error"; message: string };

type ApiErrorBody = {
  error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> };
  current?: unknown;
};

async function handleResponse<T>(
  response: Response,
  isExpectedShape: (value: unknown) => value is T,
): Promise<SnapshotApiResult<T>> {
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
    if (response.status === 404) return { status: "not_found" };
    if (response.status === 409 && code === "STALE_STATE") {
      return { status: "stale_state", current: body.current };
    }
    if (response.status === 409 && code === "IDEMPOTENCY_KEY_REUSED") {
      return { status: "idempotency_key_reused" };
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
): Promise<SnapshotApiResult<T>> {
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
// Read
// ---------------------------------------------------------------------------

export async function fetchLatestSnapshot(): Promise<
  SnapshotApiResult<{ snapshot: ResourceSnapshotComparisonDto | null }>
> {
  return request(
    "/api/resource-snapshots/latest",
    { method: "GET" },
    (v): v is { snapshot: ResourceSnapshotComparisonDto | null } => isObject(v) && "snapshot" in v,
  );
}

export async function fetchSnapshotHistory(
  from: LocalDate,
  to: LocalDate,
): Promise<SnapshotApiResult<{ snapshots: ResourceSnapshotComparisonDto[] }>> {
  const params = new URLSearchParams({ from: formatLocalDate(from), to: formatLocalDate(to) });
  return request(
    `/api/resource-snapshots?${params.toString()}`,
    { method: "GET" },
    (v): v is { snapshots: ResourceSnapshotComparisonDto[] } => isObject(v) && Array.isArray(v.snapshots),
  );
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export type SaveSnapshotInput = {
  timezone: string;
  note: string | null;
  items: ResourceSnapshotItemDto[];
};

export type SnapshotMutationResult = { ok: true; snapshot: ResourceSnapshotComparisonDto; replay: boolean };

export async function saveSnapshot(
  date: LocalDate,
  input: SaveSnapshotInput,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<SnapshotApiResult<SnapshotMutationResult>> {
  return request(
    `/api/resource-snapshots/${formatLocalDate(date)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, expectedVersion, idempotencyKey }),
    },
    hasOkTrue as (v: unknown) => v is SnapshotMutationResult,
  );
}

export type DeleteSnapshotResult = { ok: true; record: ResourceSnapshotRecordDto; replay: boolean };

export async function deleteSnapshot(
  date: LocalDate,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<SnapshotApiResult<DeleteSnapshotResult>> {
  return request(
    `/api/resource-snapshots/${formatLocalDate(date)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion, idempotencyKey }),
    },
    hasOkTrue as (v: unknown) => v is DeleteSnapshotResult,
  );
}
