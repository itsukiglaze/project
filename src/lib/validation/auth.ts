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
