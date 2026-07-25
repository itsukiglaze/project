import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.fn();
const mockGetBoundedForecast = vi.fn();
const mockGetResourceBalanceSnapshot = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/calendar-forecast-service", () => ({
  getBoundedForecast: (...args: unknown[]) => mockGetBoundedForecast(...args),
}));
vi.mock("@/server/repositories/resource-balance-repository", () => ({
  getResourceBalanceSnapshot: (...args: unknown[]) => mockGetResourceBalanceSnapshot(...args),
}));

import { GET } from "./route";

const USER = { id: "user-1", timezone: "Europe/Berlin" };

function req(query: string) {
  return new NextRequest(`https://example.com/api/calendar/forecast?${query}`);
}

describe("GET /api/calendar/forecast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
    mockGetResourceBalanceSnapshot.mockResolvedValue({ polychrome: 100 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await GET(req("days=30"));
    expect(response.status).toBe(401);
  });

  it("returns a forecast for a valid horizon (200)", async () => {
    mockGetBoundedForecast.mockResolvedValue({
      requestedHorizonDays: 30,
      effectiveHorizonDays: 30,
      rangeStart: { year: 2026, month: 1, day: 1 },
      rangeEnd: { year: 2026, month: 1, day: 31 },
      occurrences: [],
      dailyBalances: [],
      projectedEndingBalance: 100,
    });
    const response = await GET(req("days=30"));
    expect(response.status).toBe(200);
  });

  it("serializes rangeStart/rangeEnd and daily balance dates as YYYY-MM-DD strings (true JSON round-trip)", async () => {
    mockGetBoundedForecast.mockResolvedValue({
      requestedHorizonDays: 30,
      effectiveHorizonDays: 30,
      rangeStart: { year: 2026, month: 1, day: 1 },
      rangeEnd: { year: 2026, month: 1, day: 31 },
      occurrences: [],
      dailyBalances: [{ date: { year: 2026, month: 1, day: 5 }, netChange: 60, runningBalance: 160 }],
      projectedEndingBalance: 100,
    });
    const response = await GET(req("days=30"));
    const body = await response.json();
    expect(body.rangeStart).toBe("2026-01-01");
    expect(body.rangeEnd).toBe("2026-01-31");
    expect(body.dailyBalances[0].date).toBe("2026-01-05");
    expect(typeof body.rangeStart).toBe("string");
  });

  it("400s on a negative days value", async () => {
    const response = await GET(req("days=-5"));
    expect(response.status).toBe(400);
    expect(mockGetBoundedForecast).not.toHaveBeenCalled();
  });

  it("400s on a non-numeric days value", async () => {
    const response = await GET(req("days=abc"));
    expect(response.status).toBe(400);
  });

  it("passes a large requested horizon through to the service, which is responsible for the actual cap", async () => {
    mockGetBoundedForecast.mockResolvedValue({
      requestedHorizonDays: 10_000,
      effectiveHorizonDays: 90,
      rangeStart: { year: 2026, month: 1, day: 1 },
      rangeEnd: { year: 2026, month: 3, day: 31 },
      occurrences: [],
      dailyBalances: [],
      projectedEndingBalance: 100,
    });
    const response = await GET(req("days=1000"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.effectiveHorizonDays).toBe(90); // service-enforced cap reflected in the response
  });

  it("400s when the requested days exceeds the outer shape-level sanity bound", async () => {
    const response = await GET(req("days=999999999"));
    expect(response.status).toBe(400);
    expect(mockGetBoundedForecast).not.toHaveBeenCalled();
  });

  it("is side-effect free: this route imports no write service at all", async () => {
    mockGetBoundedForecast.mockResolvedValue({
      requestedHorizonDays: 7,
      effectiveHorizonDays: 7,
      rangeStart: { year: 2026, month: 1, day: 1 },
      rangeEnd: { year: 2026, month: 1, day: 7 },
      occurrences: [],
      dailyBalances: [],
      projectedEndingBalance: 100,
    });
    await GET(req("days=7"));
    expect(mockGetBoundedForecast).toHaveBeenCalledTimes(1);
  });
});
