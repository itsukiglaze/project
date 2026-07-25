import { NextResponse } from "next/server";
import { LOGIN_NONCE_COOKIE_NAME, mintLoginNonce } from "@/lib/auth/login-nonce";
import { apiError } from "@/lib/api/errors";

// Mints the anti-CSRF nonce for the Telegram Login Widget fallback (see
// lib/auth/login-nonce.ts). Never cache — every call must mint a fresh,
// single-use-per-browser nonce.
export const dynamic = "force-dynamic";

export async function GET() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Fail closed, not open: the fallback login path is simply
    // unavailable without this configured, same pattern as CRON_SECRET
    // for /api/internal/maintenance. The primary Mini App initData path
    // is completely unaffected.
    return apiError(503, "NOT_CONFIGURED", "Резервный вход временно недоступен.");
  }

  const minted = mintLoginNonce(secret);
  const response = NextResponse.json({ nonce: minted.nonce });
  response.cookies.set({
    name: LOGIN_NONCE_COOKIE_NAME,
    value: minted.cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: minted.expiresAt,
  });
  return response;
}
