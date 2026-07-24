import "server-only";
import { verifyTelegramInitData, type TelegramVerifiedUser } from "@/lib/telegram/verify";
import { normalizeTimezone } from "@/lib/validation/timezone";
import { upsertUserFromTelegram } from "@/server/repositories/user-repository";
import { createSession, type CreatedSession } from "@/server/repositories/session-repository";

export type AuthErrorCode =
  | "SERVER_MISCONFIGURED"
  | "MISSING_INIT_DATA"
  | "MALFORMED"
  | "MISSING_HASH"
  | "MISSING_AUTH_DATE"
  | "MISSING_USER"
  | "INVALID_AUTH_DATE"
  | "EXPIRED"
  | "SIGNATURE_MISMATCH";

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}

export interface AuthenticateParams {
  /** Raw initData string, or empty/undefined when relying on dev-auth. */
  initData: string | undefined;
  /** Client-reported IANA timezone (validated, falls back to UTC). */
  timezone: string | undefined;
  userAgent?: string | null;
  ipHash?: string | null;
}

export interface AuthenticateResult {
  userId: string;
  session: CreatedSession;
}

/**
 * Resolves a Telegram identity for this request.
 *
 * Production behavior: `initData` MUST be present and MUST pass signature
 * verification against TELEGRAM_BOT_TOKEN. There is no fallback.
 *
 * Development behavior (opt-in, see lib/auth/dev-auth.ts): if `initData` is
 * absent AND both `NODE_ENV === "development"` and `DEV_AUTH_ENABLED === "true"`,
 * a fixed test user (from DEV_TELEGRAM_USER_ID) is used instead. The dynamic
 * import below only ever executes inside this already-guarded branch, and
 * the imported module re-checks the same conditions independently.
 */
async function resolveTelegramUser(
  initData: string | undefined,
): Promise<TelegramVerifiedUser> {
  if (initData && initData.trim().length > 0) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new AuthError("SERVER_MISCONFIGURED");
    }
    const result = verifyTelegramInitData({ initData, botToken });
    if (!result.ok) {
      throw new AuthError(result.reason);
    }
    return result.data.user;
  }

  if (process.env.NODE_ENV === "development" && process.env.DEV_AUTH_ENABLED === "true") {
    const { getDevAuthUser } = await import("@/lib/auth/dev-auth");
    const devUser = getDevAuthUser();
    if (!devUser) {
      throw new AuthError("MISSING_INIT_DATA");
    }
    return {
      id: devUser.telegramId,
      username: devUser.username,
      firstName: devUser.firstName,
      lastName: devUser.lastName,
      languageCode: devUser.languageCode,
    };
  }

  throw new AuthError("MISSING_INIT_DATA");
}

export async function authenticateWithTelegram(
  params: AuthenticateParams,
): Promise<AuthenticateResult> {
  const telegramUser = await resolveTelegramUser(params.initData);
  const timezone = normalizeTimezone(params.timezone);

  const user = await upsertUserFromTelegram({ telegramUser, timezone });
  const session = await createSession({
    userId: user.id,
    userAgent: params.userAgent,
    ipHash: params.ipHash,
  });

  return { userId: user.id, session };
}
