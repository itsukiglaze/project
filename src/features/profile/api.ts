import type { BannerFamily } from "@/config/gacha";
import type { FieldChange } from "@/lib/diff";

export type ResourceSnapshot = {
  polychrome: number;
  monochrome: number;
  encryptedMasterTape: number;
  masterTape: number;
  boopon: number;
};

export type VersionedResourceSnapshot = ResourceSnapshot & { version: number };

export type BannerStateSnapshot = {
  sRankPity: number;
  aRankPity: number;
  guaranteeActive: boolean;
};

export type VersionedBannerStateSnapshot = BannerStateSnapshot & { version: number };

export type SaveResult<T extends Record<string, unknown>> = {
  previous: T;
  updated: T;
  changed: FieldChange<T>[];
  version: number;
  replay: boolean;
};

export type ApiClientResult<T> =
  | { status: "success"; data: T }
  | { status: "auth_error"; message: string }
  | { status: "validation_error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "conflict"; currentVersion: number; current: Record<string, unknown> }
  | { status: "network_error" }
  | { status: "unknown_error"; message: string };

type ApiErrorBody = {
  error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> };
  current?: Record<string, unknown>;
  currentVersion?: number;
};

async function handleResponse<T>(
  response: Response,
  isExpectedShape: (value: unknown) => value is T,
): Promise<ApiClientResult<T>> {
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
    if (response.status === 409 && body.error?.code === "STALE_STATE") {
      return {
        status: "conflict",
        currentVersion: body.currentVersion ?? 0,
        current: body.current ?? {},
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
): Promise<ApiClientResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, { credentials: "same-origin", ...init });
  } catch {
    return { status: "network_error" };
  }
  return handleResponse(response, isExpectedShape);
}

function isVersionedResourceSnapshot(value: unknown): value is VersionedResourceSnapshot {
  return typeof value === "object" && value !== null && "polychrome" in value && "version" in value;
}

function isSaveResourcesResult(value: unknown): value is SaveResult<ResourceSnapshot> {
  return (
    typeof value === "object" &&
    value !== null &&
    "previous" in value &&
    "updated" in value &&
    "changed" in value &&
    "version" in value
  );
}

function isBannerStatesList(
  value: unknown,
): value is { bannerStates: Array<{ family: BannerFamily } & VersionedBannerStateSnapshot> } {
  return (
    typeof value === "object" && value !== null && Array.isArray((value as { bannerStates?: unknown }).bannerStates)
  );
}

function isSaveBannerStateResult(value: unknown): value is SaveResult<BannerStateSnapshot> {
  return isSaveResourcesResult(value);
}

export async function fetchResourceSnapshot(): Promise<ApiClientResult<VersionedResourceSnapshot>> {
  return request("/api/resources", { method: "GET" }, isVersionedResourceSnapshot);
}

export async function saveResourceSnapshot(
  values: ResourceSnapshot,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<ApiClientResult<SaveResult<ResourceSnapshot>>> {
  return request(
    "/api/resources",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, expectedVersion, idempotencyKey }),
    },
    isSaveResourcesResult,
  );
}

export async function fetchAllBannerStates(): Promise<
  ApiClientResult<{ bannerStates: Array<{ family: BannerFamily } & VersionedBannerStateSnapshot> }>
> {
  return request("/api/banner-states", { method: "GET" }, isBannerStatesList);
}

export async function saveBannerStateSnapshot(
  family: BannerFamily,
  values: BannerStateSnapshot,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<ApiClientResult<SaveResult<BannerStateSnapshot>>> {
  return request(
    `/api/banner-states/${family}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, expectedVersion, idempotencyKey }),
    },
    isSaveBannerStateResult,
  );
}
