import "server-only";

/**
 * Development-only authentication bypass.
 *
 * This lets the app run OUTSIDE Telegram (e.g. `npm run dev` in a plain
 * browser) by pretending a fixed test user is logged in.
 *
 * Hard safety rules, all enforced here and NOT re-derivable by a caller:
 *   1. Requires NODE_ENV === "development" AND DEV_AUTH_ENABLED === "true".
 *      Both must hold; either one being false disables this entirely.
 *   2. The Telegram user id always comes from the server's own
 *      DEV_TELEGRAM_USER_ID environment variable — never from the request.
 *      There is no code path in this module that accepts a caller-supplied id.
 *   3. This module never imports anything Telegram-signature-related, so it
 *      cannot be used to fabricate a signature.
 *
 * The route handler that uses this module dynamically imports it, and only
 * inside a branch already guarded by the same two environment checks, so
 * this code is not reachable at all in a production build/runtime.
 */

export interface DevAuthUser {
  telegramId: bigint;
  username: string;
  firstName: string;
  lastName: string;
  languageCode: string;
}

export function isDevAuthEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_AUTH_ENABLED === "true";
}

/**
 * Returns the fixed development test user, or null if dev-auth is not
 * enabled or DEV_TELEGRAM_USER_ID is not configured.
 *
 * Deliberately ignores any arguments — this function takes no parameters,
 * so there is no way for a caller to smuggle in an arbitrary Telegram id.
 */
export function getDevAuthUser(): DevAuthUser | null {
  if (!isDevAuthEnabled()) {
    return null;
  }

  const rawId = process.env.DEV_TELEGRAM_USER_ID;
  if (!rawId) {
    return null;
  }

  let telegramId: bigint;
  try {
    telegramId = BigInt(rawId);
  } catch {
    return null;
  }

  return {
    telegramId,
    username: "dev_tester",
    firstName: "Dev",
    lastName: "Tester",
    languageCode: "ru",
  };
}
