import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { apiError } from "@/lib/api/errors";
import { purgeStaleSessions } from "@/server/repositories/session-repository";
import { purgeExpiredIdempotencyRecords } from "@/server/repositories/idempotency-repository";

// Housekeeping sweep for the two purge routines that exist but were never
// scheduled anywhere (see DEVELOPMENT_STATUS.md): expired/revoked sessions
// and expired idempotency records. Never called from any user-facing path —
// intended to be invoked on a schedule (Vercel Cron, a VPS crontab/systemd
// timer) against this one endpoint. GET, not POST, to match how Vercel Cron
// invokes routes.
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(expected);
  if (headerBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(headerBuf, expectedBuf);
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return apiError(503, "NOT_CONFIGURED", "CRON_SECRET is not set.");
  }
  if (!isAuthorized(request)) {
    return apiError(401, "UNAUTHORIZED", "Missing or invalid bearer token.");
  }

  const [sessions, idempotencyRecords] = await Promise.all([
    purgeStaleSessions(),
    purgeExpiredIdempotencyRecords(),
  ]);

  return NextResponse.json({
    ok: true,
    deleted: {
      sessions: sessions.deletedCount,
      idempotencyRecords: idempotencyRecords.deletedCount,
    },
  });
}
