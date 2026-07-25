import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockPurgeStaleSessions = vi.fn();
const mockPurgeExpiredIdempotencyRecords = vi.fn();

vi.mock("@/server/repositories/session-repository", () => ({
  purgeStaleSessions: (...args: unknown[]) => mockPurgeStaleSessions(...args),
}));
vi.mock("@/server/repositories/idempotency-repository", () => ({
  purgeExpiredIdempotencyRecords: (...args: unknown[]) => mockPurgeExpiredIdempotencyRecords(...args),
}));

import { GET } from "./route";

function req(authorization?: string) {
  const headers: Record<string, string> = authorization ? { authorization } : {};
  return new NextRequest("https://example.com/api/internal/maintenance", { headers });
}

describe("GET /api/internal/maintenance", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPurgeStaleSessions.mockResolvedValue({ deletedCount: 3 });
    mockPurgeExpiredIdempotencyRecords.mockResolvedValue({ deletedCount: 5 });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("503s when CRON_SECRET is not configured, regardless of what bearer token is sent", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(req("Bearer anything"));
    expect(response.status).toBe(503);
    expect(mockPurgeStaleSessions).not.toHaveBeenCalled();
  });

  it("401s when no authorization header is sent", async () => {
    process.env.CRON_SECRET = "test-secret";
    const response = await GET(req());
    expect(response.status).toBe(401);
    expect(mockPurgeStaleSessions).not.toHaveBeenCalled();
  });

  it("401s on a wrong bearer token", async () => {
    process.env.CRON_SECRET = "test-secret";
    const response = await GET(req("Bearer wrong-secret"));
    expect(response.status).toBe(401);
    expect(mockPurgeExpiredIdempotencyRecords).not.toHaveBeenCalled();
  });

  it("runs both purges and returns their counts on a correct bearer token (200)", async () => {
    process.env.CRON_SECRET = "test-secret";
    const response = await GET(req("Bearer test-secret"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, deleted: { sessions: 3, idempotencyRecords: 5 } });
    expect(mockPurgeStaleSessions).toHaveBeenCalledTimes(1);
    expect(mockPurgeExpiredIdempotencyRecords).toHaveBeenCalledTimes(1);
  });
});
