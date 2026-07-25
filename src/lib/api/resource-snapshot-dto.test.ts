import { describe, expect, it } from "vitest";
import { CurrencyType } from "@/lib/calendar-math";
import { serializeSnapshotComparison, serializeSnapshotRecord } from "./resource-snapshot-dto";

/** True JSON round-trip: JSON.stringify -> JSON.parse, matching Response.json()'s real serialization path. */
function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const RECORD_WITH_REAL_DATE = {
  id: "snap-1",
  localDate: { year: 2026, month: 7, day: 25 },
  capturedAt: new Date("2026-07-25T10:00:00.000Z"),
  timezone: "UTC",
  note: null,
  items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }],
  version: 1,
};

describe("serializeSnapshotRecord", () => {
  it("formats localDate as YYYY-MM-DD and capturedAt as an ISO string when given a real Date", () => {
    const dto = serializeSnapshotRecord(RECORD_WITH_REAL_DATE);
    expect(dto.localDate).toBe("2026-07-25");
    expect(dto.capturedAt).toBe("2026-07-25T10:00:00.000Z");
  });

  it("survives a real JSON round trip (localDate/capturedAt come out as strings, not objects)", () => {
    const wire = roundTrip(serializeSnapshotRecord(RECORD_WITH_REAL_DATE));
    expect(typeof wire.localDate).toBe("string");
    expect(typeof wire.capturedAt).toBe("string");
  });

  /**
   * Regression test for a real bug found via live verification against
   * Postgres: `IdempotencyRecord.responseSnapshot` is a `Json` column, so a
   * stored response containing a real `capturedAt: Date` round-trips
   * through Prisma's own JSON storage and comes back out as a plain ISO
   * STRING, not a `Date` object, on replay. The serializer must accept
   * either without throwing `capturedAt.toISOString is not a function`.
   */
  it("accepts capturedAt as an already-serialized ISO string (idempotency replay shape) without throwing", () => {
    const replayed = { ...RECORD_WITH_REAL_DATE, capturedAt: "2026-07-25T10:00:00.000Z" };
    expect(() => serializeSnapshotRecord(replayed)).not.toThrow();
    expect(serializeSnapshotRecord(replayed).capturedAt).toBe("2026-07-25T10:00:00.000Z");
  });
});

describe("serializeSnapshotComparison", () => {
  it("serializes previousLocalDate and nests a correctly-serialized record", () => {
    const dto = serializeSnapshotComparison({
      record: RECORD_WITH_REAL_DATE,
      comparison: [{ currencyType: CurrencyType.POLYCHROME, current: 5420, previous: 5000, delta: 420, status: "positive" }],
      previousLocalDate: { year: 2026, month: 7, day: 24 },
    });
    expect(dto.previousLocalDate).toBe("2026-07-24");
    expect(dto.record.localDate).toBe("2026-07-25");
  });

  it("serializes previousLocalDate as null when there is no previous snapshot", () => {
    const dto = serializeSnapshotComparison({
      record: RECORD_WITH_REAL_DATE,
      comparison: [{ currencyType: CurrencyType.POLYCHROME, current: 5420, status: "no_previous_snapshot" }],
      previousLocalDate: null,
    });
    expect(dto.previousLocalDate).toBeNull();
  });

  it("handles the idempotency-replay shape (string capturedAt) inside the nested record too", () => {
    const dto = serializeSnapshotComparison({
      record: { ...RECORD_WITH_REAL_DATE, capturedAt: "2026-07-25T10:00:00.000Z" },
      comparison: [],
      previousLocalDate: null,
    });
    expect(dto.record.capturedAt).toBe("2026-07-25T10:00:00.000Z");
  });
});
