import "server-only";
import { prisma } from "@/lib/db/prisma";
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_TOKEN_BYTES,
} from "@/lib/auth/session-token";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CreateSessionInput {
  userId: string;
  userAgent?: string | null;
  ipHash?: string | null;
}

export interface CreatedSession {
  rawToken: string;
  expiresAt: Date;
}

/**
 * Creates a new session and returns the RAW token (to be set in the
 * HttpOnly cookie). Only the hash of this token is persisted.
 */
export async function createSession(input: CreateSessionInput): Promise<CreatedSession> {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash,
      userAgent: input.userAgent ?? undefined,
      ipHash: input.ipHash ?? undefined,
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

export interface ActiveSession {
  sessionId: string;
  userId: string;
}

/**
 * Looks up a session by its raw cookie token. Returns null if the token is
 * malformed, unknown, expired, or revoked. Also opportunistically updates
 * `lastUsedAt`.
 */
export async function findActiveSessionByRawToken(
  rawToken: string,
): Promise<ActiveSession | null> {
  if (typeof rawToken !== "string" || rawToken.length === 0 || rawToken.length > 512) {
    return null;
  }

  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.session.findUnique({ where: { tokenHash } });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  // Best-effort — a failure here should not block the request.
  void prisma.session
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return { sessionId: session.id, userId: session.userId };
}

export async function revokeSessionByRawToken(rawToken: string): Promise<void> {
  if (typeof rawToken !== "string" || rawToken.length === 0) return;
  const tokenHash = hashSessionToken(rawToken);
  await prisma.session
    .updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch(() => undefined);
}

export { SESSION_TOKEN_BYTES };

/**
 * Deletes sessions that are expired or were revoked more than `olderThan`
 * ago. This is intentionally NOT called from any request-handling path —
 * running a DELETE on every login/logout would add unnecessary write load
 * to a hot path for a purely housekeeping concern.
 *
 * Intended to be invoked from a scheduled job (e.g. a daily cron / Vercel
 * Cron Job hitting a protected internal endpoint, or a one-off maintenance
 * script). Wiring that schedule up is tracked as a Stage 3 task — see
 * README "Future improvements".
 */
export async function purgeStaleSessions(
  olderThan: Date = new Date(),
): Promise<{ deletedCount: number }> {
  const result = await prisma.session.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: olderThan } }, { revokedAt: { lt: olderThan } }],
    },
  });
  return { deletedCount: result.count };
}
