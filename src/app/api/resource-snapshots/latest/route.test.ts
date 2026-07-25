import { beforeEach, describe, expect, it, vi } from "vitest";
import { CurrencyType } from "@/lib/calendar-math";

const mockGetCurrentUser = vi.fn();
const mockGetLatestResourceSnapshot = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/services/resource-snapshot-service", () => ({
  getLatestResourceSnapshot: (...args: unknown[]) => mockGetLatestResourceSnapshot(...args),
}));

import { GET } from "./route";

const USER = { id: "user-1" };

function snapshotView(overrides: Record<string, unknown> = {}) {
  return {
    record: {
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
    },
    comparison: [{ currencyType: CurrencyType.POLYCHROME, current: 5420, previous: 5000, delta: 420, status: "positive" }],
    previousLocalDate: { year: 2026, month: 7, day: 24 },
    ...overrides,
  };
}

describe("GET /api/resource-snapshots/latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns snapshot: null when the user has never saved one", async () => {
    mockGetLatestResourceSnapshot.mockResolvedValue(null);
    const response = await GET();
    const body = await response.json();
    expect(body).toEqual({ snapshot: null });
  });

  it("serializes localDate as a YYYY-MM-DD string and capturedAt as an ISO instant", async () => {
    mockGetLatestResourceSnapshot.mockResolvedValue(snapshotView());
    const response = await GET();
    const body = await response.json();
    expect(body.snapshot.record.localDate).toBe("2026-07-25");
    expect(typeof body.snapshot.record.localDate).toBe("string");
    expect(body.snapshot.record.capturedAt).toBe("2026-07-25T10:00:00.000Z");
    expect(body.snapshot.previousLocalDate).toBe("2026-07-24");
  });

  it("includes the per-currency comparison in the response", async () => {
    mockGetLatestResourceSnapshot.mockResolvedValue(snapshotView());
    const response = await GET();
    const body = await response.json();
    expect(body.snapshot.comparison).toEqual([
      { currencyType: CurrencyType.POLYCHROME, current: 5420, previous: 5000, delta: 420, status: "positive" },
    ]);
  });
});
