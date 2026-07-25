import { z } from "zod";

/**
 * Request body for POST /api/auth/telegram.
 *
 * `initData` is the raw, still-signed string from
 * `window.Telegram.WebApp.initData` — verified server-side before use.
 * Deliberately NOT `.min(1)`: `getRawInitData()` (src/lib/telegram/webapp.ts)
 * returns `""` whenever the app isn't running inside Telegram, and that
 * empty string is exactly what routes a request to the dev-auth fallback
 * (or a clean MISSING_INIT_DATA/401 in production) in
 * `resolveTelegramUser` (auth-service.ts). Rejecting it here with a generic
 * 400 would make the documented dev-auth bypass unreachable through the
 * real endpoint.
 *
 * `timezone` is read client-side via
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` (Telegram does not
 * provide it) and is re-validated server-side; invalid values fall back to
 * UTC rather than being rejected outright, so a bad client clock/locale
 * doesn't block login.
 */
export const telegramAuthRequestSchema = z
  .object({
    initData: z.string().max(8192),
    timezone: z.string().min(1).max(100).optional(),
  })
  .strict();

export type TelegramAuthRequest = z.infer<typeof telegramAuthRequestSchema>;

/**
 * Request body for POST /api/auth/telegram-login/verify — the Telegram
 * Login Widget fallback (see server/services/auth-service.ts,
 * lib/telegram/verify-login-widget.ts). All Telegram-supplied fields are
 * carried as strings — the widget's JS callback hands them as a mix of
 * numbers/strings depending on field, and the client normalizes every
 * field to a string before this request is built, matching what the
 * verifier's HMAC check expects (the raw redirect-mode query string is
 * all-string too, so this keeps both call shapes consistent).
 *
 * `nonce` is the anti-CSRF value from the /nonce step, echoed back —
 * see lib/auth/login-nonce.ts for why this can't ride inside Telegram's
 * own signed payload.
 */
export const telegramLoginWidgetRequestSchema = z
  .object({
    id: z.string().min(1).max(32),
    first_name: z.string().max(256).optional(),
    last_name: z.string().max(256).optional(),
    username: z.string().max(256).optional(),
    photo_url: z.string().max(2048).optional(),
    auth_date: z.string().min(1).max(32),
    hash: z.string().min(1).max(256),
    nonce: z.string().min(1).max(256),
    timezone: z.string().min(1).max(100).optional(),
  })
  .strict();

export type TelegramLoginWidgetRequest = z.infer<typeof telegramLoginWidgetRequestSchema>;

/**
 * Request body for POST /api/diagnostics/auth — a privacy-safe, structured
 * client-side report of *how* a launch/auth attempt went, for operators to
 * diagnose unofficial-client quirks (e.g. the AyuGram empty-initData case)
 * from Vercel logs. The schema itself is the enforcement: there is no
 * field here for initData, hash, token, user payload, cookies, or any
 * other secret/PII — an extra field can't be smuggled through either,
 * since this is `.strict()`.
 */
export const authDiagnosticEventSchema = z
  .object({
    platform: z.string().max(64).nullable(),
    webAppVersion: z.string().max(32).nullable(),
    initDataPresent: z.boolean(),
    launchPath: z.enum(["webapp", "webapp_empty_init_data", "no_webapp", "login_widget", "dev_auth"]),
    authFailureCategory: z.string().max(64).nullable(),
  })
  .strict();

export type AuthDiagnosticEvent = z.infer<typeof authDiagnosticEventSchema>;
