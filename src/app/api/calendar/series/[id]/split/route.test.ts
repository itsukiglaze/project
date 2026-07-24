import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.fn();
const mockSplitEventSeries = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/calendar-event-series-service", () => ({
  splitEventSeries: (...args: unknown[]) => mockSplitEventSeries(...args),
}));

import { POST } from "./route";

const USER = { id: "user-1" };

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "INCOME",
    currencyType: "POLYCHROME",
    amount: 999,
    source: "DAILY",
    bannerFamily: null,
    note: null,
    rule: {
      frequency: "DAILY",
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: null,
      startDate: "2026-01-10",
      endType: "NEVER",
      endDate: null,
      occurrenceCount: null,
    },
    splitDate: "2026-01-10",
    expectedVersion: 1,
    idempotencyKey: "a-valid-key-12345",
    ...overrides,
  };
}

function req(body: unknown) {
  return new NextRequest("https://example.com/api/calendar/series/series-1/split", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function ctx(id = "series-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/calendar/series/[id]/split", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await POST(req(validBody()), ctx());
    expect(response.status).toBe(401);
  });

  it("splits successfully (200)", async () => {
    mockSplitEventSeries.mockResolvedValue({
      ok: true,
      mode: "SPLIT",
      oldSeries: { id: "series-1" },
      newSeries: { id: "series-2" },
      reassignedExceptionCount: 0,
      replay: false,
    });
    const response = await POST(req(validBody()), ctx());
    expect(response.status).toBe(200);
  });

  it("400s on an invalid split date (bad calendar day)", async () => {
    const response = await POST(req(validBody({ splitDate: "2026-02-30" })), ctx());
    expect(response.status).toBe(400);
  });

  it("maps INVALID_OCCURRENCE to 422", async () => {
    mockSplitEventSeries.mockResolvedValue({
      ok: false,
      kind: "INVALID_OCCURRENCE",
      errors: ["not a scheduled occurrence"],
    });
    const response = await POST(req(validBody()), ctx());
    expect(response.status).toBe(422);
  });

  it("maps NOT_FOUND to 404", async () => {
    mockSplitEventSeries.mockResolvedValue({ ok: false, kind: "NOT_FOUND" });
    const response = await POST(req(validBody()), ctx("someone-elses-series"));
    expect(response.status).toBe(404);
  });

  it("maps STALE_STATE to 409", async () => {
    mockSplitEventSeries.mockResolvedValue({
      ok: false,
      kind: "STALE_STATE",
      current: { id: "series-1", version: 4 },
    });
    const response = await POST(req(validBody()), ctx());
    expect(response.status).toBe(409);
  });
});
