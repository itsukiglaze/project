import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { telegramLoginWidgetRequestSchema } from "@/lib/validation/auth";
import {
  authenticateWithTelegramLoginWidget,
  LoginWidgetAuthError,
  type LoginWidgetErrorCode,
} from "@/server/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-token";
import { LOGIN_NONCE_COOKIE_NAME } from "@/lib/auth/login-nonce";
import { apiError } from "@/lib/api/errors";
import { logUnexpectedError } from "@/lib/api/error-logging";

// Telegram Login Widget fallback verify step — mutates state (creates a
// session), consumes the one-time nonce cookie. Never cache.
export const dynamic = "force-dynamic";

const LOGIN_WIDGET_ERROR_STATUS: Record<LoginWidgetErrorCode, number> = {
  SERVER_MISCONFIGURED: 500,
  CSRF_REJECTED: 403,
  MISSING_HASH: 400,
  MISSING_AUTH_DATE: 400,
  INVALID_AUTH_DATE: 400,
  MISSING_ID: 400,
  INVALID_ID: 400,
  EXPIRED: 401,
  SIGNATURE_MISMATCH: 401,
};

const MAX_BODY_BYTES = 8 * 1024;

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

/** Clears the one-time nonce cookie regardless of outcome — it must never be reusable. */
function clearNonceCookie(response: NextResponse): void {
  response.cookies.set({
    name: LOGIN_NONCE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function POST(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "Тело запроса слишком велико.");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Некорректный JSON в теле запроса.");
  }

  const parsed = telegramLoginWidgetRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Проверьте переданные данные.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const nonceCookieValue = request.cookies.get(LOGIN_NONCE_COOKIE_NAME)?.value;

  try {
    const { nonce, timezone, ...payload } = parsed.data;
    const result = await authenticateWithTelegramLoginWidget({
      payload,
      submittedNonce: nonce,
      nonceCookieValue,
      timezone,
      userAgent: request.headers.get("user-agent"),
      ipHash: hashIp(clientIp),
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: result.session.rawToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: result.session.expiresAt,
    });
    clearNonceCookie(response);
    return response;
  } catch (err) {
    if (err instanceof LoginWidgetAuthError) {
      const response = apiError(
        LOGIN_WIDGET_ERROR_STATUS[err.code] ?? 400,
        err.code,
        "Не удалось подтвердить вход через Telegram.",
      );
      clearNonceCookie(response);
      return response;
    }
    logUnexpectedError("auth/telegram-login/verify: unexpected error", err);
    const response = apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
    clearNonceCookie(response);
    return response;
  }
}
