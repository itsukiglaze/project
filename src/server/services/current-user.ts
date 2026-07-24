import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-token";
import { findActiveSessionByRawToken } from "@/server/repositories/session-repository";
import { findUserById } from "@/server/repositories/user-repository";

/**
 * Resolves the current user strictly from the server-side session — never
 * from any client-supplied user id or header. This is what makes IDOR
 * (asking for someone else's data by passing their id) impossible: every
 * API route must call this instead of trusting request input.
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const session = await findActiveSessionByRawToken(rawToken);
  if (!session) return null;

  return findUserById(session.userId);
}
