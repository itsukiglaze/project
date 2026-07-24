import type { BannerFamily } from "@/config/gacha";
import type { GuaranteedCalculationResult } from "@/lib/gacha-math";

/**
 * Request payload — intentionally has NO userId/telegramId field. The
 * server always resolves the user from the session cookie; there is no
 * field here through which one could even attempt to pass one.
 */
export type CalculatorRequestPayload = {
  family: BannerFamily;
  targetCopies: number;
  useSavedResources: boolean;
  useSavedBannerState: boolean;
  resourceOverrides?: {
    polychrome?: number;
    monochrome?: number;
    encryptedMasterTape?: number;
    masterTape?: number;
    boopon?: number;
    includeMonochrome?: boolean;
  };
  bannerStateOverrides?: {
    sRankPity?: number;
    aRankPity?: number;
    guaranteeActive?: boolean;
  };
};

export type CalculatedApiResponse = { kind: "CALCULATED" } & GuaranteedCalculationResult;
export type UnsupportedApiResponse = { kind: "UNSUPPORTED_TARGET"; reason: string };
export type CalculatorSuccessResponse = CalculatedApiResponse | UnsupportedApiResponse;

export type CalculatorClientResult =
  | { status: "success"; data: CalculatorSuccessResponse }
  | { status: "auth_error"; message: string }
  | { status: "validation_error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "network_error" }
  | { status: "aborted" }
  | { status: "unknown_error"; message: string };

type ApiErrorBody = {
  error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> };
};

function isCalculatorSuccessResponse(value: unknown): value is CalculatorSuccessResponse {
  if (typeof value !== "object" || value === null || !("kind" in value)) return false;
  const kind = (value as { kind: unknown }).kind;
  return kind === "CALCULATED" || kind === "UNSUPPORTED_TARGET";
}

export async function submitCalculatorRequest(
  payload: CalculatorRequestPayload,
  signal?: AbortSignal,
): Promise<CalculatorClientResult> {
  let response: Response;
  try {
    response = await fetch("/api/calculator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { status: "aborted" };
    }
    return { status: "network_error" };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { status: "unknown_error", message: "Сервер вернул некорректный ответ." };
  }

  if (!response.ok) {
    const body = json as ApiErrorBody;
    if (response.status === 401) {
      return {
        status: "auth_error",
        message: body.error?.message ?? "Требуется вход через Telegram.",
      };
    }
    if (response.status === 400) {
      return {
        status: "validation_error",
        message: body.error?.message ?? "Проверьте переданные данные.",
        fieldErrors: body.error?.fieldErrors,
      };
    }
    return {
      status: "unknown_error",
      message: body.error?.message ?? "Внутренняя ошибка сервера.",
    };
  }

  // HTTP 200 alone is not treated as a successful calculation — the body
  // shape (`kind`) is what actually decides that.
  if (!isCalculatorSuccessResponse(json)) {
    return { status: "unknown_error", message: "Неожиданный формат ответа сервера." };
  }

  return { status: "success", data: json };
}
