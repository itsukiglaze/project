import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * How long a client can retry with the same idempotency key and still get
 * a replayed response. Not "forever" — see purgeExpiredIdempotencyRecords.
 */
export const IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function idempotencyExpiryFromNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS);
}

export type IdempotencyLookupResult<T> =
  | { status: "missing" }
  | { status: "match"; response: T }
  | { status: "mismatch" };

/**
 * Looks up a stored idempotency record and compares its `requestHash`
 * against the hash of the CURRENT request.
 *
 * - "missing": no unexpired record for this key — proceed with the write.
 * - "match": same key, same (normalized, canonicalized) payload — replay
 *   the stored response, do not write again.
 * - "mismatch": same key, but the payload hash differs — this key is
 *   being reused for a genuinely different request, which is a client
 *   bug, not a legitimate retry. Callers must reject this (see
 *   IDEMPOTENCY_KEY_REUSED in resource-service.ts / banner-state-service.ts)
 *   rather than silently replaying the wrong stored result.
 */
export async function lookupIdempotencyRecord<T>(
  userId: string,
  action: string,
  idempotencyKey: string,
  requestHash: string,
): Promise<IdempotencyLookupResult<T>> {
  const row = await prisma.idempotencyRecord.findUnique({
    where: { userId_action_idempotencyKey: { userId, action, idempotencyKey } },
  });

  if (!row) return { status: "missing" };
  // An expired record is treated as absent — the client is free to reuse
  // the key (even for a different payload) once retention has lapsed.
  if (row.expiresAt.getTime() <= Date.now()) return { status: "missing" };

  if (row.requestHash !== requestHash) {
    return { status: "mismatch" };
  }

  return { status: "match", response: row.responseSnapshot as T };
}

/**
 * Records the response for a given (user, action, key, requestHash) so a
 * retried request with the same key AND the same payload can be answered
 * without reapplying the write. Must be called inside the same
 * transaction as the write it's guarding — see resource-service.ts /
 * banner-state-service.ts.
 *
 * The (userId, action, idempotencyKey) unique constraint is what actually
 * makes concurrent identical requests safe: if two requests race past the
 * initial `lookupIdempotencyRecord` check at the same time, only one of
 * their `create` calls here can succeed — the other throws a unique
 * constraint violation (Prisma P2002), which callers catch and turn into
 * either a replay (matching hash) or an IDEMPOTENCY_KEY_REUSED conflict
 * (mismatched hash) — see isIdempotencyConflict below.
 */
export async function createIdempotencyRecord(
  tx: Prisma.TransactionClient,
  userId: string,
  action: string,
  idempotencyKey: string,
  requestHash: string,
  responseSnapshot: unknown,
): Promise<void> {
  await tx.idempotencyRecord.create({
    data: {
      userId,
      action,
      idempotencyKey,
      requestHash,
      responseSnapshot: responseSnapshot as Prisma.InputJsonValue,
      expiresAt: idempotencyExpiryFromNow(),
    },
  });
}

/** True if `err` is the unique-constraint violation from a losing race on createIdempotencyRecord. */
export function isIdempotencyConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && (err as { code: string }).code === "P2002"
  );
}

/**
 * Deletes idempotency records past their retention window.
 *
 * NOT called from any request-handling path (same rationale as
 * purgeStaleSessions in session-repository.ts) — intended for a scheduled
 * job. Tracked as a Stage 5 task to actually wire up a schedule for this.
 */
export async function purgeExpiredIdempotencyRecords(
  now: Date = new Date(),
): Promise<{ deletedCount: number }> {
  const result = await prisma.idempotencyRecord.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return { deletedCount: result.count };
}
