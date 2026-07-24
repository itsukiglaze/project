import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.fn();
const mockCreateOneTimeCalendarTransaction = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/calendar-transaction-service", () => ({
  createOneTimeCalendarTransaction: (...args: unknown[]) => mockCreateOneTimeCalendarTransaction(...args),
}));

import { POST } from "./route";

const USER = { id: "user-1" };

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    localDate: "2026-01-05",
    type: "INCOME",
    currencyType: "POLYCHROME",
    amount: 300,
    source: "EVENT",
    bannerFamily: null,
    note: null,
    timezone: "Europe/Berlin",
    idempotencyKey: "a-valid-key-12345",
    ...overrides,
  };
}

function req(body: unknown) {
  return new NextRequest("https://example.com/api/calendar/transactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/calendar/transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await POST(req(validBody()));
    expect(response.status).toBe(401);
  });

  it("creates successfully (200)", async () => {
    mockCreateOneTimeCalendarTransaction.mockResolvedValue({ ok: true, record: { id: "tx-1" }, replay: false });
    const response = await POST(req(validBody()));
    expect(response.status).toBe(200);
  });

  it("400s on an invalid local date", async () => {
    const response = await POST(req(validBody({ localDate: "2026-13-01" })));
    expect(response.status).toBe(400);
  });

  it("400s on missing idempotencyKey", async () => {
    const body = validBody() as Record<string, unknown>;
    delete body.idempotencyKey;
    const response = await POST(req(body));
    expect(response.status).toBe(400);
  });

  it("400s on unknown field (strict schema)", async () => {
    const response = await POST(req(validBody({ userId: "someone-else" })));
    expect(response.status).toBe(400);
    expect(mockCreateOneTimeCalendarTransaction).not.toHaveBeenCalled();
  });

  it("allows PULL type for one-time transactions", async () => {
    mockCreateOneTimeCalendarTransaction.mockResolvedValue({ ok: true, record: { id: "tx-1" }, replay: false });
    const response = await POST(
      req(
        validBody({
          type: "PULL",
          currencyType: "ENCRYPTED_MASTER_TAPE",
          source: null,
          bannerFamily: "EXCLUSIVE_AGENT",
        }),
      ),
    );
    expect(response.status).toBe(200);
  });

  it("maps a service VALIDATION_ERROR to 400", async () => {
    mockCreateOneTimeCalendarTransaction.mockResolvedValue({
      ok: false,
      kind: "VALIDATION_ERROR",
      errors: ["bad"],
    });
    const response = await POST(req(validBody()));
    expect(response.status).toBe(400);
  });

  it("maps IDEMPOTENCY_KEY_REUSED to 409", async () => {
    mockCreateOneTimeCalendarTransaction.mockResolvedValue({ ok: false, kind: "IDEMPOTENCY_KEY_REUSED" });
    const response = await POST(req(validBody()));
    expect(response.status).toBe(409);
  });
});
