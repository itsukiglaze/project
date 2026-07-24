import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.fn();
const mockCreateEventSeries = vi.fn();
const mockListActiveSeriesForUser = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/calendar-event-series-service", () => ({
  createEventSeries: (...args: unknown[]) => mockCreateEventSeries(...args),
}));
vi.mock("@/server/repositories/calendar-event-series-repository", () => ({
  listActiveSeriesForUser: (...args: unknown[]) => mockListActiveSeriesForUser(...args),
}));

import { GET, POST } from "./route";

const USER = { id: "user-1" };

function validBody(overrides: Record<string, unknown> = {}) {
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
    timezone: "Europe/Berlin",
    idempotencyKey: "a-valid-key-12345",
    ...overrides,
  };
}

function postRequest(body: unknown) {
  return new NextRequest("https://example.com/api/calendar/series", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/calendar/series", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await POST(postRequest(validBody()));
    expect(response.status).toBe(401);
    expect(mockCreateEventSeries).not.toHaveBeenCalled();
  });

  it("creates a series on valid input (200)", async () => {
    mockCreateEventSeries.mockResolvedValue({ ok: true, record: { id: "series-1" }, replay: false });
    const response = await POST(postRequest(validBody()));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("never passes userId through to the service from the body — it always comes from the session", async () => {
    mockCreateEventSeries.mockResolvedValue({ ok: true, record: { id: "series-1" }, replay: false });
    await POST(postRequest(validBody()));
    expect(mockCreateEventSeries.mock.calls[0][0]).toBe("user-1");
  });

  it("400s on malformed JSON", async () => {
    const response = await POST(postRequest("{not valid json"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("400s and rejects an unknown field (strict schema)", async () => {
    const response = await POST(postRequest(validBody({ userId: "someone-else" })));
    expect(response.status).toBe(400);
    expect(mockCreateEventSeries).not.toHaveBeenCalled();
  });

  it("400s on an invalid local date (bad calendar day)", async () => {
    const response = await POST(
      postRequest(validBody({ rule: { ...validBody().rule, startDate: "2026-02-30" } })),
    );
    expect(response.status).toBe(400);
  });

  it("400s on an invalid recurrence combination (interval < 1)", async () => {
    const response = await POST(
      postRequest(validBody({ rule: { ...validBody().rule, interval: 0 } })),
    );
    expect(response.status).toBe(400);
  });

  it("400s when idempotencyKey is missing", async () => {
    const body = validBody() as Record<string, unknown>;
    delete body.idempotencyKey;
    const response = await POST(postRequest(body));
    expect(response.status).toBe(400);
  });

  it("400s when idempotencyKey is too short", async () => {
    const response = await POST(postRequest(validBody({ idempotencyKey: "short" })));
    expect(response.status).toBe(400);
  });

  it("maps a service VALIDATION_ERROR to 400", async () => {
    mockCreateEventSeries.mockResolvedValue({ ok: false, kind: "VALIDATION_ERROR", errors: ["bad"] });
    const response = await POST(postRequest(validBody()));
    expect(response.status).toBe(400);
  });

  it("maps IDEMPOTENCY_KEY_REUSED to 409", async () => {
    mockCreateEventSeries.mockResolvedValue({ ok: false, kind: "IDEMPOTENCY_KEY_REUSED" });
    const response = await POST(postRequest(validBody()));
    expect(response.status).toBe(409);
  });
});

describe("GET /api/calendar/series", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("lists active series for the current user only (read-only, no write mocks touched)", async () => {
    mockListActiveSeriesForUser.mockResolvedValue([{ id: "series-1" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.series).toHaveLength(1);
    expect(mockListActiveSeriesForUser).toHaveBeenCalledWith("user-1");
    expect(mockCreateEventSeries).not.toHaveBeenCalled();
  });
});
