import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Short-lived, signed anti-CSRF nonce for the Telegram Login Widget
 * fallback (see server/services/auth-service.ts and the
 * /api/auth/telegram-login/* routes).
 *
 * The Login Widget protocol itself has no state/nonce passthrough — its
 * callback payload is exactly Telegram's own fixed field set (id,
 * first_name, ..., hash), nothing app-supplied can ride along with it. So
 * the CSRF defense has to live one layer up: mint a random nonce, hand
 * the raw value to the client (to echo back in its POST body) and a
 * SIGNED copy to an HttpOnly cookie (so a cross-origin attacker page can
 * neither read nor forge it), and require the two to match on verify.
 * This is the classic double-submit-cookie pattern, made self-verifying
 * (HMAC-signed, no server-side nonce store needed) rather than requiring
 * a DB table for a 5-minute-lived, rarely-used fallback path.
 *
 * Security property this actually gives: defeats cross-origin CSRF (an
 * attacker page cannot read/set our HttpOnly cookie or guess the random
 * nonce). It is NOT a replay-proof single-use token store — a party that
 * already has cookie access (e.g. via XSS) could resubmit within the TTL,
 * but that threat model is already beyond what CSRF protection covers.
 * The underlying Telegram-signed payload's own `auth_date` freshness
 * check (verify-login-widget.ts) adds a second, independent time bound.
 */

export const LOGIN_NONCE_COOKIE_NAME = "ppp_login_nonce";
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface MintedLoginNonce {
  /** Raw value returned to the client — it must echo this back in its POST body. */
  nonce: string;
  /** Opaque, HMAC-signed value to store in the HttpOnly cookie. */
  cookieValue: string;
  expiresAt: Date;
}

function sign(secret: string, nonce: string, expiresAtMs: number): string {
  return createHmac("sha256", secret).update(`${nonce}.${expiresAtMs}`).digest("hex");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function mintLoginNonce(secret: string, now: () => number = Date.now): MintedLoginNonce {
  const nonce = randomBytes(32).toString("base64url");
  const expiresAtMs = now() + NONCE_TTL_MS;
  const cookieValue = `${nonce}.${expiresAtMs}.${sign(secret, nonce, expiresAtMs)}`;
  return { nonce, cookieValue, expiresAt: new Date(expiresAtMs) };
}

export type LoginNonceVerifyResult =
  | { ok: true }
  | {
      ok: false;
      reason: "MISSING_COOKIE" | "MALFORMED_COOKIE" | "SIGNATURE_MISMATCH" | "EXPIRED" | "NONCE_MISMATCH";
    };

export interface VerifyLoginNonceOptions {
  /** Raw value of the HttpOnly cookie set by mintLoginNonce. */
  cookieValue: string | undefined;
  /** The nonce value submitted in the client's POST body. */
  submittedNonce: string | undefined;
  secret: string;
  now?: () => number;
}

export function verifyLoginNonce(options: VerifyLoginNonceOptions): LoginNonceVerifyResult {
  const { cookieValue, submittedNonce, secret, now = Date.now } = options;

  if (!cookieValue) return { ok: false, reason: "MISSING_COOKIE" };

  const parts = cookieValue.split(".");
  if (parts.length !== 3) return { ok: false, reason: "MALFORMED_COOKIE" };
  const [nonce, expiresAtRaw, sig] = parts;
  const expiresAtMs = Number(expiresAtRaw);
  if (!nonce || !sig || !Number.isFinite(expiresAtMs)) {
    return { ok: false, reason: "MALFORMED_COOKIE" };
  }

  const expectedSig = sign(secret, nonce, expiresAtMs);
  if (!timingSafeEqualStrings(expectedSig, sig)) {
    return { ok: false, reason: "SIGNATURE_MISMATCH" };
  }

  if (now() > expiresAtMs) return { ok: false, reason: "EXPIRED" };

  if (!submittedNonce || !timingSafeEqualStrings(nonce, submittedNonce)) {
    return { ok: false, reason: "NONCE_MISMATCH" };
  }

  return { ok: true };
}
