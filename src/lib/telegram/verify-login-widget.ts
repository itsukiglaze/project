import { createHash, createHmac } from "crypto";

/**
 * Server-side verification of the Telegram Login Widget's authorization
 * payload — the official web fallback for logging in outside a Mini App
 * WebView (https://core.telegram.org/widgets/login#checking-authorization).
 *
 * This is a DIFFERENT protocol from Mini App `initData` (see
 * `lib/telegram/verify.ts`) and, critically, uses a DIFFERENT secret-key
 * derivation — mixing the two up would silently break verification (or
 * worse, invite a cross-protocol confusion bug):
 *
 *   Mini App initData:    secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)
 *   Login Widget:         secret_key = SHA256(bot_token)               <- plain digest, used directly as the HMAC key
 *
 *   data_check_string = all received fields except `hash`, sorted
 *                        alphabetically by key, formatted "key=value",
 *                        joined with "\n" (same shape as initData, just a
 *                        different field set: id, first_name, last_name,
 *                        username, photo_url, auth_date)
 *   expected_hash = HEX( HMAC_SHA256(key=secret_key, data=data_check_string) )
 */

export interface TelegramLoginWidgetPayload {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}

export interface TelegramLoginVerifiedUser {
  id: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
}

export type TelegramLoginVerifyFailureReason =
  | "MISSING_HASH"
  | "MISSING_AUTH_DATE"
  | "INVALID_AUTH_DATE"
  | "MISSING_ID"
  | "INVALID_ID"
  | "EXPIRED"
  | "SIGNATURE_MISMATCH";

export type TelegramLoginVerifyResult =
  | { ok: true; data: TelegramLoginVerifiedUser }
  | { ok: false; reason: TelegramLoginVerifyFailureReason };

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60; // 24h, matching the Mini App path's own window
const CLOCK_SKEW_TOLERANCE_SECONDS = 5;

function buildDataCheckString(fields: Record<string, string | undefined>): string {
  const entries: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === "hash" || value === undefined) continue;
    entries.push(`${key}=${value}`);
  }
  entries.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return entries.join("\n");
}

function computeExpectedHash(botToken: string, dataCheckString: string): string {
  const secretKey = createHash("sha256").update(botToken).digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

/** Constant-time string comparison to avoid timing side-channels. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface VerifyTelegramLoginWidgetOptions {
  payload: TelegramLoginWidgetPayload;
  /** TELEGRAM_BOT_TOKEN — server-side only, never sent to the client. Same bot as the Mini App. */
  botToken: string;
  maxAgeSeconds?: number;
  /** Injectable for tests; defaults to Date.now. */
  now?: () => number;
}

export function verifyTelegramLoginWidget(
  options: VerifyTelegramLoginWidgetOptions,
): TelegramLoginVerifyResult {
  const { payload, botToken, maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS, now = Date.now } = options;

  if (!payload.hash) {
    return { ok: false, reason: "MISSING_HASH" };
  }
  if (!payload.auth_date) {
    return { ok: false, reason: "MISSING_AUTH_DATE" };
  }
  const authDateSeconds = Number(payload.auth_date);
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    return { ok: false, reason: "INVALID_AUTH_DATE" };
  }
  if (!payload.id) {
    return { ok: false, reason: "MISSING_ID" };
  }
  let idAsBigInt: bigint;
  try {
    idAsBigInt = BigInt(payload.id);
  } catch {
    return { ok: false, reason: "INVALID_ID" };
  }

  const dataCheckString = buildDataCheckString({
    id: payload.id,
    first_name: payload.first_name,
    last_name: payload.last_name,
    username: payload.username,
    photo_url: payload.photo_url,
    auth_date: payload.auth_date,
  });
  const expectedHash = computeExpectedHash(botToken, dataCheckString);
  if (!timingSafeEqualHex(expectedHash, payload.hash)) {
    return { ok: false, reason: "SIGNATURE_MISMATCH" };
  }

  const nowSeconds = now() / 1000;
  const ageSeconds = nowSeconds - authDateSeconds;
  if (ageSeconds < -CLOCK_SKEW_TOLERANCE_SECONDS || ageSeconds > maxAgeSeconds) {
    return { ok: false, reason: "EXPIRED" };
  }

  return {
    ok: true,
    data: {
      id: idAsBigInt,
      username: payload.username,
      firstName: payload.first_name,
      lastName: payload.last_name,
      photoUrl: payload.photo_url,
    },
  };
}
