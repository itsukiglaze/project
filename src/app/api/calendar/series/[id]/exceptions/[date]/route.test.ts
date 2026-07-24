import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.fn();
const mockUpsertOccurrenceException = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/calendar-event-exception-service", () => ({
  upsertOccurrenceException: (...args: unknown[]) => mockUpsertOccurrenceException(...args),
}));

import { PUT } from "./route";

const USER = { id: "user-1" };

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    isCancelled: true,
    amountOverride: null,
    currencyTypeOverride: null,
    sourceOverride: null,
    bannerFamilyOverride: null,
    noteOverride: null,
    expectedVersion: 0,
    idempotencyKey: "a-valid-key-12345",
    ...overrides,
  };
}

function req(body: unknown) {
  return new NextRequest("https://example.com/api/calendar/series/series-1/exceptions/2026-01-05", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function ctx(id = "series-1", date = "2026-01-05") {
  return { params: Promise.resolve({ id, date }) };
}

describe("PUT /api/calendar/series/[id]/exceptions/[date]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await PUT(req(validBody()), ctx());
    expect(response.status).toBe(401);
  });

  it("upserts successfully (200)", async () => {
    mockUpsertOccurrenceException.mockResolvedValue({
      ok: true,
      record: { seriesId: "series-1" },
      replay: false,
    });
    const response = await PUT(req(validBody()), ctx());
    expect(response.status).toBe(200);
  });

  it("400s on an invalid date in the URL path", async () => {
    const response = await PUT(req(validBody()), ctx("series-1", "2026-02-30"));
    expect(response.status).toBe(400);
    expect(mockUpsertOccurrenceException).not.toHaveBeenCalled();
  });

  it("400s on a malformed date string in the URL path", async () => {
    const response = await PUT(req(validBody()), ctx("series-1", "not-a-date"));
    expect(response.status).toBe(400);
  });

  it("maps INVALID_OCCURRENCE to 422", async () => {
    mockUpsertOccurrenceException.mockResolvedValue({
      ok: false,
      kind: "INVALID_OCCURRENCE",
      errors: ["not scheduled"],
    });
    const response = await PUT(req(validBody()), ctx());
    expect(response.status).toBe(422);
  });

  it("maps NOT_FOUND to 404 (ownership isolation)", async () => {
    mockUpsertOccurrenceException.mockResolvedValue({ ok: false, kind: "NOT_FOUND" });
    const response = await PUT(req(validBody()), ctx("someone-elses-series"));
    expect(response.status).toBe(404);
  });

  it("maps STALE_STATE to 409", async () => {
    mockUpsertOccurrenceException.mockResolvedValue({
      ok: false,
      kind: "STALE_STATE",
      current: { seriesId: "series-1", version: 2 },
    });
    const response = await PUT(req(validBody()), ctx());
    expect(response.status).toBe(409);
  });

  it("400s on an invalid amountOverride", async () => {
    const response = await PUT(req(validBody({ isCancelled: false, amountOverride: -5 })), ctx());
    expect(response.status).toBe(400);
  });

  it("rejects an unknown field (strict schema), e.g. a `type` override attempt", async () => {
    const response = await PUT(req(validBody({ type: "EXPENSE" })), ctx());
    expect(response.status).toBe(400);
  });
});
