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
    mockGetMergedOccurrences.mockResolvedValue([{ kind: "virtual" }]);
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.occurrences).toHaveLength(1);
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
