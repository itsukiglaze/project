import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CurrencyType } from "@/lib/calendar-math";

const mockGetCurrentUser = vi.fn();
const mockListResourceSnapshotHistory = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/resource-snapshot-service", () => ({
  listResourceSnapshotHistory: (...args: unknown[]) => mockListResourceSnapshotHistory(...args),
}));

import { GET } from "./route";

const USER = { id: "user-1" };

function req(from: string, to: string) {
  return new NextRequest(`https://example.com/api/resource-snapshots?from=${from}&to=${to}`);
}

function snapshotView(localDate: { year: number; month: number; day: number }) {
  return {
    record: {
      id: "snap-1",
      userId: "user-1",
      localDate,
      capturedAt: new Date("2026-07-25T10:00:00.000Z"),
      timezone: "UTC",
      note: null,
      items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }],
      version: 1,
      createdAt: new Date("2026-07-25T10:00:00.000Z"),
      updatedAt: new Date("2026-07-25T10:00:00.000Z"),
    },
    comparison: [],
    previousLocalDate: null,
  };
}

describe("GET /api/resource-snapshots (history)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await GET(req("2026-07-01", "2026-07-31"));
    expect(response.status).toBe(401);
  });

  it("returns history in ascending date order, dates serialized as YYYY-MM-DD strings", async () => {
    mockListResourceSnapshotHistory.mockResolvedValue([
      snapshotView({ year: 2026, month: 7, day: 20 }),
      snapshotView({ year: 2026, month: 7, day: 25 }),
    ]);
    const response = await GET(req("2026-07-01", "2026-07-31"));
    const body = await response.json();
    expect(body.snapshots).toHaveLength(2);
    expect(body.snapshots[0].record.localDate).toBe("2026-07-20");
    expect(body.snapshots[1].record.localDate).toBe("2026-07-25");
  });

  it("400s when from is missing", async () => {
    const response = await GET(new NextRequest("https://example.com/api/resource-snapshots?to=2026-07-31"));
    expect(response.status).toBe(400);
  });

  it("400s when from is after to", async () => {
    const response = await GET(req("2026-07-31", "2026-07-01"));
    expect(response.status).toBe(400);
  });

  it("400s when the range exceeds the maximum span", async () => {
    const response = await GET(req("2020-01-01", "2026-07-25"));
    expect(response.status).toBe(400);
  });
});
