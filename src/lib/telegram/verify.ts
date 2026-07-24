import { createHmac } from "crypto";

/**
 * Server-side verification of Telegram WebApp `initData`.
 *
 * This implements the algorithm described in the official Telegram Mini Apps
 * documentation:
 *
 *   data_check_string = all fields except `hash`, sorted alphabetically by
 *                        key, formatted as "key=value" and joined with "\n"
 *   secret_key = HMAC_SHA256(key = "WebAppData", data = <bot token>)
 *   expected_hash = HEX( HMAC_SHA256(key = secret_key, data = data_check_string) )
 *
 * `initData` is only trusted after this check passes. Reading
 * `window.Telegram.WebApp.initDataUnsafe` on the client is NEVER sufficient
 * on its own — it must be re-verified here using TELEGRAM_BOT_TOKEN, which
 * never leaves the server.
 */

export interface TelegramVerifiedUser {
  id: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  photoUrl?: string;
}

export interface TelegramVerifiedInitData {
  user: TelegramVerifiedUser;
  authDate: Date;
}

export type TelegramVerifyFailureReason =
  | "MALFORMED"
  | "MISSING_HASH"
  | "MISSING_AUTH_DATE"
  | "MISSING_USER"
  | "INVALID_AUTH_DATE"
  | "EXPIRED"
  | "SIGNATURE_MISMATCH";

export type TelegramVerifyResult =
  | { ok: true; data: TelegramVerifiedInitData }
  | { ok: false; reason: TelegramVerifyFailureReason };

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60; // 24h, matches Telegram's own guidance
/** Small tolerance for clock drift between the client and this server. */
const CLOCK_SKEW_TOLERANCE_SECONDS = 5;

function buildDataCheckString(params: URLSearchParams): string {
  const entries: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    entries.push(`${key}=${value}`);
  }
  entries.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return entries.join("\n");
}

function computeExpectedHash(botToken: string, dataCheckString: string): string {
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
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

interface RawTelegramUser {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  photo_url?: string;
}

function parseUserField(raw: string): TelegramVerifiedUser | null {
  let parsed: RawTelegramUser;
  try {
    parsed = JSON.parse(raw) as RawTelegramUser;
  } catch {
    return null;
  }
  if (parsed == null || (typeof parsed.id !== "number" && typeof parsed.id !== "string")) {
    return null;
  }
  let idAsBigInt: bigint;
  try {
    idAsBigInt = BigInt(parsed.id);
  } catch {
    return null;
  }
  return {
    id: idAsBigInt,
    username: parsed.username,
    firstName: parsed.first_name,
    lastName: parsed.last_name,
    languageCode: parsed.language_code,
    photoUrl: parsed.photo_url,
  };
}

export interface VerifyTelegramInitDataOptions {
  /** Raw `initData` string as received from `window.Telegram.WebApp.initData`. */
  initData: string;
  /** TELEGRAM_BOT_TOKEN — server-side only, never sent to the client. */
  botToken: string;
  /** Maximum allowed age of `auth_date`, in seconds. Defaults to 24h. */
  maxAgeSeconds?: number;
  /** Injectable for tests; defaults to Date.now. */
  now?: () => number;
}

export function verifyTelegramInitData(
  options: VerifyTelegramInitDataOptions,
): TelegramVerifyResult {
  const { initData, botToken, maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS, now = Date.now } = options;

  if (!initData || typeof initData !== "string") {
    return { ok: false, reason: "MALFORMED" };
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }

  const hash = params.get("hash");
  if (!hash) {
    return { ok: false, reason: "MISSING_HASH" };
  }

  const authDateRaw = params.get("auth_date");
  if (!authDateRaw) {
    return { ok: false, reason: "MISSING_AUTH_DATE" };
  }
  const authDateSeconds = Number(authDateRaw);
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    return { ok: false, reason: "INVALID_AUTH_DATE" };
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    return { ok: false, reason: "MISSING_USER" };
  }
  const user = parseUserField(userRaw);
  if (!user) {
    return { ok: false, reason: "MISSING_USER" };
  }

  const dataCheckString = buildDataCheckString(params);
  const expectedHash = computeExpectedHash(botToken, dataCheckString);
  if (!timingSafeEqualHex(expectedHash, hash)) {
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
      user,
      authDate: new Date(authDateSeconds * 1000),
    },
  };
}
