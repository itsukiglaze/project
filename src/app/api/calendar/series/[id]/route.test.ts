import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.fn();
const mockUpdateEventSeries = vi.fn();
const mockDeleteEventSeries = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/calendar-event-series-service", () => ({
  updateEventSeries: (...args: unknown[]) => mockUpdateEventSeries(...args),
  deleteEventSeries: (...args: unknown[]) => mockDeleteEventSeries(...args),
}));

import { DELETE, PUT } from "./route";

const USER = { id: "user-1" };

function validUpdateBody(overrides: Record<string, unknown> = {}) {
  return {
    type: "INCOME",
    currencyType: "POLYCHROME",
    amount: 60,
    source: "DAILY",
    bannerFamily: null,
    note: null,
    rule: {
      frequency: "DAILY",
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: null,
      startDate: "2026-01-01",
      endType: "NEVER",
      endDate: null,
      occurrenceCount: null,
    },
    expectedVersion: 1,
    idempotencyKey: "a-valid-key-12345",
    ...overrides,
  };
}

function req(method: string, body: unknown) {
  return new NextRequest("https://example.com/api/calendar/series/series-1", {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function ctx(id = "series-1") {
  return { params: Promise.resolve({ id }) };
}

describe("PUT /api/calendar/series/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await PUT(req("PUT", validUpdateBody()), ctx());
    expect(response.status).toBe(401);
  });

  it("updates on valid input (200)", async () => {
    mockUpdateEventSeries.mockResolvedValue({ ok: true, record: { id: "series-1", version: 2 }, replay: false });
    const response = await PUT(req("PUT", validUpdateBody()), ctx());
    expect(response.status).toBe(200);
  });

  it("400s on malformed JSON", async () => {
    const response = await PUT(req("PUT", "{bad json"), ctx());
    expect(response.status).toBe(400);
  });

  it("400s when expectedVersion is missing", async () => {
    const body = validUpdateBody() as Record<string, unknown>;
    delete body.expectedVersion;
    const response = await PUT(req("PUT", body), ctx());
    expect(response.status).toBe(400);
  });

  it("maps STALE_STATE to 409 with the current record in the body", async () => {
    mockUpdateEventSeries.mockResolvedValue({
      ok: false,
      kind: "STALE_STATE",
      current: { id: "series-1", version: 5 },
    });
    const response = await PUT(req("PUT", validUpdateBody()), ctx());
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("STALE_STATE");
    expect(body.current.version).toBe(5);
  });

  it("maps NOT_FOUND to 404 (ownership isolation: foreign/nonexistent series look identical)", async () => {
    mockUpdateEventSeries.mockResolvedValue({ ok: false, kind: "NOT_FOUND" });
    const response = await PUT(req("PUT", validUpdateBody()), ctx("someone-elses-series"));
    expect(response.status).toBe(404);
  });

  it("maps IDEMPOTENCY_KEY_REUSED to 409", async () => {
    mockUpdateEventSeries.mockResolvedValue({ ok: false, kind: "IDEMPOTENCY_KEY_REUSED" });
    const response = await PUT(req("PUT", validUpdateBody()), ctx());
    expect(response.status).toBe(409);
  });

  it("rejects an unknown field (strict schema) — timezone is not accepted on update (frozen at creation)", async () => {
    const response = await PUT(req("PUT", validUpdateBody({ timezone: "Europe/Berlin" })), ctx());
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/calendar/series/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await DELETE(
      req("DELETE", { expectedVersion: 1, idempotencyKey: "a-valid-key-12345" }),
      ctx(),
    );
    expect(response.status).toBe(401);
  });

  it("soft-deletes on valid input (200)", async () => {
    mockDeleteEventSeries.mockResolvedValue({
      ok: true,
      record: { id: "series-1", isActive: false },
      replay: false,
    });
    const response = await DELETE(
      req("DELETE", { expectedVersion: 1, idempotencyKey: "a-valid-key-12345" }),
      ctx(),
    );
    expect(response.status).toBe(200);
  });

  it("maps STALE_STATE to 409", async () => {
    mockDeleteEventSeries.mockResolvedValue({
      ok: false,
      kind: "STALE_STATE",
      current: { id: "series-1", version: 3 },
    });
    const response = await DELETE(
      req("DELETE", { expectedVersion: 1, idempotencyKey: "a-valid-key-12345" }),
      ctx(),
    );
    expect(response.status).toBe(409);
  });

  it("400s when idempotencyKey is missing", async () => {
    const response = await DELETE(req("DELETE", { expectedVersion: 1 }), ctx());
    expect(response.status).toBe(400);
  });
});
