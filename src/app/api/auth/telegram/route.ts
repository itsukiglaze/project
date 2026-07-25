import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { telegramAuthRequestSchema } from "@/lib/validation/auth";
import { authenticateWithTelegram, AuthError } from "@/server/services/auth-service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-token";
import { apiError } from "@/lib/api/errors";

// Telegram initData is single-use-ish and this endpoint mutates state
// (creates sessions) — never cache it.
export const dynamic = "force-dynamic";

const AUTH_ERROR_STATUS: Record<AuthError["code"], number> = {
  SERVER_MISCONFIGURED: 500,
  MISSING_INIT_DATA: 401,
  MALFORMED: 400,
  MISSING_HASH: 400,
  MISSING_AUTH_DATE: 400,
  MISSING_USER: 400,
  INVALID_AUTH_DATE: 400,
  EXPIRED: 401,
  SIGNATURE_MISMATCH: 401,
};

const MAX_BODY_BYTES = 16 * 1024;

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * `console.error("...", err)` alone can render as just the string message
 * in Vercel's collapsed log view, hiding exactly the detail needed to
 * diagnose a production-only failure (e.g. a DB connection error, which
 * is a plain Error/AggregateError, not an AuthError). Pull out every field
 * that matters into one flat, always-expanded log line: message, stack,
 * and — duck-typed, since importing Prisma's error classes here isn't
 * worth the coupling — any `code`/`errorCode`/`meta`/`clientVersion`
 * Prisma error classes attach (PrismaClientKnownRequestError,
 * PrismaClientInitializationError, etc.).
 */
function describeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { value: err };
  }
  const record = err as unknown as Record<string, unknown>;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...(typeof record.code !== "undefined" ? { code: record.code } : {}),
    ...(typeof record.errorCode !== "undefined" ? { errorCode: record.errorCode } : {}),
    ...(typeof record.meta !== "undefined" ? { meta: record.meta } : {}),
    ...(typeof record.clientVersion !== "undefined" ? { clientVersion: record.clientVersion } : {}),
    ...(err.cause ? { cause: describeError(err.cause) } : {}),
  };
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

  const parsed = telegramAuthRequestSchema.safeParse(json);
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

  try {
    const result = await authenticateWithTelegram({
      initData: parsed.data.initData,
      timezone: parsed.data.timezone,
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
    return response;
  } catch (err) {
    if (err instanceof AuthError) {
      return apiError(
        AUTH_ERROR_STATUS[err.code] ?? 400,
        err.code,
        "Не удалось подтвердить вход через Telegram.",
      );
    }
    console.error("auth/telegram: unexpected error", JSON.stringify(describeError(err)));
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}
