import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.fn();
const mockUpdateOneTimeCalendarTransaction = vi.fn();
const mockDeleteOneTimeCalendarTransaction = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/calendar-transaction-service", () => ({
  updateOneTimeCalendarTransaction: (...args: unknown[]) => mockUpdateOneTimeCalendarTransaction(...args),
  deleteOneTimeCalendarTransaction: (...args: unknown[]) => mockDeleteOneTimeCalendarTransaction(...args),
}));

import { DELETE, PUT } from "./route";

const USER = { id: "user-1" };

/** A realistic TransactionRecord — localDate/occurrenceDate are real LocalDate objects here. */
function transactionRecordFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "tx-1",
    localDate: { year: 2026, month: 1, day: 5 },
    type: "INCOME",
    currencyType: "POLYCHROME",
    amount: 300,
    source: "EVENT",
    bannerFamily: null,
    note: null,
    seriesId: null,
    occurrenceDate: null,
    version: 1,
    ...overrides,
  };
}

function validUpdateBody(overrides: Record<string, unknown> = {}) {
  return {
    localDate: "2026-01-05",
    type: "INCOME",
    currencyType: "POLYCHROME",
    amount: 300,
    source: "EVENT",
    bannerFamily: null,
    note: null,
    timezone: "Europe/Berlin",
    expectedVersion: 1,
    idempotencyKey: "a-valid-key-12345",
    ...overrides,
  };
}

function req(method: string, body: unknown) {
  return new NextRequest("https://example.com/api/calendar/transactions/tx-1", {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function ctx(id = "tx-1") {
  return { params: Promise.resolve({ id }) };
}

describe("PUT /api/calendar/transactions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await PUT(req("PUT", validUpdateBody()), ctx());
    expect(response.status).toBe(401);
  });

  it("updates successfully (200)", async () => {
    mockUpdateOneTimeCalendarTransaction.mockResolvedValue({
      ok: true,
      record: transactionRecordFixture({ version: 2 }),
      replay: false,
    });
    const response = await PUT(req("PUT", validUpdateBody()), ctx());
    expect(response.status).toBe(200);
  });

  it("serializes the updated record's localDate as a YYYY-MM-DD string (true JSON round-trip)", async () => {
    mockUpdateOneTimeCalendarTransaction.mockResolvedValue({
      ok: true,
      record: transactionRecordFixture({ version: 2, localDate: { year: 2026, month: 7, day: 4 } }),
      replay: false,
    });
    const response = await PUT(req("PUT", validUpdateBody()), ctx());
    const body = await response.json();
    expect(body.record.localDate).toBe("2026-07-04");
    expect(typeof body.record.localDate).toBe("string");
  });

  it("maps STALE_STATE to 409", async () => {
    mockUpdateOneTimeCalendarTransaction.mockResolvedValue({
      ok: false,
      kind: "STALE_STATE",
      current: transactionRecordFixture({ version: 3 }),
    });
    const response = await PUT(req("PUT", validUpdateBody()), ctx());
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.current.localDate).toBe("2026-01-05");
  });

  it("maps NOT_FOUND to 404 (ownership isolation)", async () => {
    mockUpdateOneTimeCalendarTransaction.mockResolvedValue({ ok: false, kind: "NOT_FOUND" });
    const response = await PUT(req("PUT", validUpdateBody()), ctx("someone-elses-tx"));
    expect(response.status).toBe(404);
  });

  it("maps a materialized-series-transaction rejection (VALIDATION_ERROR) to 400", async () => {
    mockUpdateOneTimeCalendarTransaction.mockResolvedValue({
      ok: false,
      kind: "VALIDATION_ERROR",
      errors: ["materializes a series occurrence"],
    });
    const response = await PUT(req("PUT", validUpdateBody()), ctx());
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/calendar/transactions/[id]", () => {
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

  it("deletes successfully (200)", async () => {
    mockDeleteOneTimeCalendarTransaction.mockResolvedValue({
      ok: true,
      record: transactionRecordFixture(),
      replay: false,
    });
    const response = await DELETE(
      req("DELETE", { expectedVersion: 1, idempotencyKey: "a-valid-key-12345" }),
      ctx(),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.record.localDate).toBe("2026-01-05");
  });

  it("400s on missing idempotencyKey", async () => {
    const response = await DELETE(req("DELETE", { expectedVersion: 1 }), ctx());
    expect(response.status).toBe(400);
  });

  it("maps IDEMPOTENCY_KEY_REUSED to 409", async () => {
    mockDeleteOneTimeCalendarTransaction.mockResolvedValue({ ok: false, kind: "IDEMPOTENCY_KEY_REUSED" });
    const response = await DELETE(
      req("DELETE", { expectedVersion: 1, idempotencyKey: "a-valid-key-12345" }),
      ctx(),
    );
    expect(response.status).toBe(409);
  });
});
