import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Session tokens are opaque, cryptographically random values.
 *
 * The RAW token is set in the HttpOnly cookie and never stored anywhere
 * server-side. Only its SHA-256 hash is persisted in the `sessions` table,
 * so a database leak alone cannot be used to hijack a session.
 */

export const SESSION_COOKIE_NAME = "ppp_session";
export const SESSION_TOKEN_BYTES = 32; // 256 bits of entropy

export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Constant-time comparison, useful when comparing hashes fetched from a DB. */
export function safeCompareHashes(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
