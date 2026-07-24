import { z } from "zod";

/**
 * Request body for POST /api/auth/telegram.
 *
 * `initData` is the raw, still-signed string from
 * `window.Telegram.WebApp.initData` — verified server-side before use.
 *
 * `timezone` is read client-side via
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` (Telegram does not
 * provide it) and is re-validated server-side; invalid values fall back to
 * UTC rather than being rejected outright, so a bad client clock/locale
 * doesn't block login.
 */
export const telegramAuthRequestSchema = z
  .object({
    initData: z.string().min(1).max(8192),
    timezone: z.string().min(1).max(100).optional(),
  })
  .strict();

export type TelegramAuthRequest = z.infer<typeof telegramAuthRequestSchema>;
