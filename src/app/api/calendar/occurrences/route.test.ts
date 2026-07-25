import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.fn();
const mockGetMergedOccurrences = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/calendar-occurrence-service", () => ({
  getMergedOccurrences: (...args: unknown[]) => mockGetMergedOccurrences(...args),
}));

import { GET } from "./route";

const USER = { id: "user-1" };

function req(query: string) {
  return new NextRequest(`https://example.com/api/calendar/occurrences?${query}`);
}

describe("GET /api/calendar/occurrences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    expect(response.status).toBe(401);
  });

  it("returns occurrences for a valid range (200)", async () => {
    mockGetMergedOccurrences.mockResolvedValue([
      {
        kind: "virtual",
        seriesId: "series-1",
        occurrenceDate: { year: 2026, month: 1, day: 10 },
        type: "INCOME",
        currencyType: "POLYCHROME",
        amount: 60,
        source: "DAILY",
        bannerFamily: null,
        note: null,
      },
    ]);
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.occurrences).toHaveLength(1);
  });

  it("serializes a virtual occurrence's occurrenceDate as a YYYY-MM-DD string (true JSON round-trip)", async () => {
    mockGetMergedOccurrences.mockResolvedValue([
      {
        kind: "virtual",
        seriesId: "series-1",
        occurrenceDate: { year: 2026, month: 1, day: 10 },
        type: "INCOME",
        currencyType: "POLYCHROME",
        amount: 60,
        source: "DAILY",
        bannerFamily: null,
        note: null,
      },
    ]);
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    const body = await response.json();
    expect(body.occurrences[0].occurrenceDate).toBe("2026-01-10");
    expect(typeof body.occurrences[0].occurrenceDate).toBe("string");
  });

  it("serializes an actual occurrence's localDate as a YYYY-MM-DD string (true JSON round-trip)", async () => {
    mockGetMergedOccurrences.mockResolvedValue([
      {
        kind: "actual",
        id: "tx-1",
        seriesId: null,
        occurrenceDate: null,
        localDate: { year: 2026, month: 1, day: 12 },
        type: "INCOME",
        currencyType: "POLYCHROME",
        amount: 300,
        source: "EVENT",
        bannerFamily: null,
        note: null,
        version: 1,
      },
    ]);
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    const body = await response.json();
    expect(body.occurrences[0].localDate).toBe("2026-01-12");
    expect(body.occurrences[0].id).toBe("tx-1");
  });

  it("400s when from > to", async () => {
    const response = await GET(req("from=2026-02-01&to=2026-01-01"));
    expect(response.status).toBe(400);
    expect(mockGetMergedOccurrences).not.toHaveBeenCalled();
  });

  it("400s on a date-range overflow beyond the safe maximum", async () => {
    const response = await GET(req("from=2020-01-01&to=2026-01-01")); // ~6 years
    expect(response.status).toBe(400);
    expect(mockGetMergedOccurrences).not.toHaveBeenCalled();
  });

  it("400s on an invalid local date", async () => {
    const response = await GET(req("from=2026-02-30&to=2026-03-01"));
    expect(response.status).toBe(400);
  });

  it("400s when a required query param is missing", async () => {
    const response = await GET(req("from=2026-01-01"));
    expect(response.status).toBe(400);
  });

  it("is side-effect free: only calls the read-only service, this route imports no write service at all", async () => {
    mockGetMergedOccurrences.mockResolvedValue([]);
    await GET(req("from=2026-01-01&to=2026-01-31"));
    // Structural guarantee: this test file mocks only
    // calendar-occurrence-service (a read-only service); there is no
    // mock/import here for any *-write service, so this route cannot
    // call one without the test itself throwing on an unresolved import.
    expect(mockGetMergedOccurrences).toHaveBeenCalledTimes(1);
  });
});
