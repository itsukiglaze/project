import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.fn();
const mockGetStatisticsOverview = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/statistics-service", () => ({
  getStatisticsOverview: (...args: unknown[]) => mockGetStatisticsOverview(...args),
}));

import { GET } from "./route";

const USER = { id: "user-1", timezone: "Europe/Berlin" };

function req(query: string) {
  return new NextRequest(`https://example.com/api/statistics/overview?${query}`);
}

const EMPTY_OVERVIEW = {
  range: { from: { year: 2026, month: 1, day: 1 }, to: { year: 2026, month: 1, day: 31 }, today: { year: 2026, month: 1, day: 15 } },
  actual: { incomeTotals: [], expenseTotals: [], pullTotals: [], netFlowPolychrome: 0 },
  scheduled: { incomeTotals: [], expenseTotals: [], pullTotals: [], netFlowPolychrome: 0 },
  expectedRangeTotal: { income: [], expense: [], pulls: [], netFlowPolychrome: 0 },
  timeline: [],
  breakdowns: { bySource: [], byBannerFamily: [], byTransactionType: [] },
};

describe("GET /api/statistics/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    expect(response.status).toBe(401);
    expect(mockGetStatisticsOverview).not.toHaveBeenCalled();
  });

  it("returns a statistics overview for a valid range (200), scoped to the requesting user only", async () => {
    mockGetStatisticsOverview.mockResolvedValue(EMPTY_OVERVIEW);
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    expect(response.status).toBe(200);
    expect(mockGetStatisticsOverview).toHaveBeenCalledWith(
      "user-1",
      expect.any(Object),
      { year: 2026, month: 1, day: 1 },
      { year: 2026, month: 1, day: 31 },
    );
  });

  it("formats range/timeline dates as YYYY-MM-DD strings in the response body", async () => {
    mockGetStatisticsOverview.mockResolvedValue({
      ...EMPTY_OVERVIEW,
      timeline: [
        {
          date: { year: 2026, month: 1, day: 15 },
          actualIncomePolychrome: 0,
          actualExpensePolychrome: 0,
          actualPulls: 0,
          actualCumulativeNetPolychrome: 0,
          scheduledIncomePolychrome: 0,
          scheduledExpensePolychrome: 0,
          scheduledPulls: 0,
          projectedCumulativeNetPolychrome: 0,
        },
      ],
    });
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    const body = await response.json();
    expect(body.range.from).toBe("2026-01-01");
    expect(body.range.to).toBe("2026-01-31");
    expect(body.range.timezone).toBe("Europe/Berlin");
    expect(body.timeline[0].date).toBe("2026-01-15");
  });

  it("400s when from > to", async () => {
    const response = await GET(req("from=2026-02-01&to=2026-01-01"));
    expect(response.status).toBe(400);
    expect(mockGetStatisticsOverview).not.toHaveBeenCalled();
  });

  it("400s on a date-range overflow beyond the safe maximum", async () => {
    const response = await GET(req("from=2020-01-01&to=2026-01-01")); // ~6 years
    expect(response.status).toBe(400);
    expect(mockGetStatisticsOverview).not.toHaveBeenCalled();
  });

  it("400s on an invalid local date", async () => {
    const response = await GET(req("from=2026-02-30&to=2026-03-01"));
    expect(response.status).toBe(400);
  });

  it("400s when a required query param is missing", async () => {
    const response = await GET(req("from=2026-01-01"));
    expect(response.status).toBe(400);
  });

  it("is side-effect free: this route imports no write service at all", async () => {
    mockGetStatisticsOverview.mockResolvedValue(EMPTY_OVERVIEW);
    await GET(req("from=2026-01-01&to=2026-01-31"));
    expect(mockGetStatisticsOverview).toHaveBeenCalledTimes(1);
  });
});
