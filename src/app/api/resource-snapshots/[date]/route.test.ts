import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CurrencyType } from "@/lib/calendar-math";

const mockGetCurrentUser = vi.fn();
const mockSaveResourceSnapshot = vi.fn();
const mockDeleteResourceSnapshot = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/resource-snapshot-service", () => ({
  saveResourceSnapshot: (...args: unknown[]) => mockSaveResourceSnapshot(...args),
  deleteResourceSnapshot: (...args: unknown[]) => mockDeleteResourceSnapshot(...args),
}));

import { DELETE, PUT } from "./route";

const USER = { id: "user-1" };

function snapshotRecordFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "snap-1",
    userId: "user-1",
    localDate: { year: 2026, month: 7, day: 25 },
    capturedAt: new Date("2026-07-25T10:00:00.000Z"),
    timezone: "UTC",
    note: null,
    items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }],
    version: 1,
    createdAt: new Date("2026-07-25T10:00:00.000Z"),
    updatedAt: new Date("2026-07-25T10:00:00.000Z"),
    ...overrides,
  };
}

function putBody(overrides: Record<string, unknown> = {}) {
  return {
    timezone: "UTC",
    note: null,
    items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }],
    expectedVersion: 0,
    idempotencyKey: "a-valid-key-12345",
    ...overrides,
  };
}

function putReq(body: unknown, date = "2026-07-25") {
  return new NextRequest(`https://example.com/api/resource-snapshots/${date}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function deleteReq(body: unknown, date = "2026-07-25") {
  return new NextRequest(`https://example.com/api/resource-snapshots/${date}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function ctx(date = "2026-07-25") {
  return { params: Promise.resolve({ date }) };
}

describe("PUT /api/resource-snapshots/[date]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await PUT(putReq(putBody()), ctx());
    expect(response.status).toBe(401);
  });

  it("400s on an invalid date in the URL path", async () => {
    const response = await PUT(putReq(putBody()), ctx("2026-02-30"));
    expect(response.status).toBe(400);
    expect(mockSaveResourceSnapshot).not.toHaveBeenCalled();
  });

  it("400s on a malformed date string in the URL path", async () => {
    const response = await PUT(putReq(putBody()), ctx("not-a-date"));
    expect(response.status).toBe(400);
  });

  it("saves successfully (200) and serializes localDate/capturedAt", async () => {
    mockSaveResourceSnapshot.mockResolvedValue({
      ok: true,
      snapshot: { record: snapshotRecordFixture(), comparison: [], previousLocalDate: null },
      replay: false,
    });
    const response = await PUT(putReq(putBody()), ctx());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.snapshot.record.localDate).toBe("2026-07-25");
    expect(typeof body.snapshot.record.capturedAt).toBe("string");
  });

  it("400s on a negative amount", async () => {
    const response = await PUT(
      putReq(putBody({ items: [{ currencyType: CurrencyType.POLYCHROME, amount: -5 }] })),
      ctx(),
    );
    expect(response.status).toBe(400);
    expect(mockSaveResourceSnapshot).not.toHaveBeenCalled();
  });

  it("400s on an unsupported currency type", async () => {
    const response = await PUT(
      putReq(putBody({ items: [{ currencyType: "GOLD_BARS", amount: 5 }] })),
      ctx(),
    );
    expect(response.status).toBe(400);
  });

  it("rejects an unknown field (strict schema)", async () => {
    const response = await PUT(putReq(putBody({ userId: "someone-else" })), ctx());
    expect(response.status).toBe(400);
    expect(mockSaveResourceSnapshot).not.toHaveBeenCalled();
  });

  it("maps STALE_STATE to 409 and serializes the current record", async () => {
    mockSaveResourceSnapshot.mockResolvedValue({
      ok: false,
      kind: "STALE_STATE",
      current: snapshotRecordFixture({ version: 2 }),
    });
    const response = await PUT(putReq(putBody()), ctx());
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.current.localDate).toBe("2026-07-25");
  });

  it("maps IDEMPOTENCY_KEY_REUSED to 409", async () => {
    mockSaveResourceSnapshot.mockResolvedValue({ ok: false, kind: "IDEMPOTENCY_KEY_REUSED" });
    const response = await PUT(putReq(putBody()), ctx());
    expect(response.status).toBe(409);
  });

  it("passes the parsed path date through to the service", async () => {
    mockSaveResourceSnapshot.mockResolvedValue({
      ok: true,
      snapshot: { record: snapshotRecordFixture(), comparison: [], previousLocalDate: null },
      replay: false,
    });
    await PUT(putReq(putBody()), ctx("2026-08-01"));
    expect(mockSaveResourceSnapshot).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ localDate: { year: 2026, month: 8, day: 1 } }),
      0,
      "a-valid-key-12345",
    );
  });
});

describe("DELETE /api/resource-snapshots/[date]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await DELETE(deleteReq({ expectedVersion: 1, idempotencyKey: "a-valid-key-12345" }), ctx());
    expect(response.status).toBe(401);
  });

  it("deletes successfully (200)", async () => {
    mockDeleteResourceSnapshot.mockResolvedValue({ ok: true, record: snapshotRecordFixture(), replay: false });
    const response = await DELETE(deleteReq({ expectedVersion: 1, idempotencyKey: "a-valid-key-12345" }), ctx());
    expect(response.status).toBe(200);
  });

  it("maps NOT_FOUND to 404", async () => {
    mockDeleteResourceSnapshot.mockResolvedValue({ ok: false, kind: "NOT_FOUND" });
    const response = await DELETE(deleteReq({ expectedVersion: 1, idempotencyKey: "a-valid-key-12345" }), ctx());
    expect(response.status).toBe(404);
  });

  it("maps STALE_STATE to 409", async () => {
    mockDeleteResourceSnapshot.mockResolvedValue({
      ok: false,
      kind: "STALE_STATE",
      current: snapshotRecordFixture({ version: 2 }),
    });
    const response = await DELETE(deleteReq({ expectedVersion: 1, idempotencyKey: "a-valid-key-12345" }), ctx());
    expect(response.status).toBe(409);
  });
});
