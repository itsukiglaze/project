import { describe, expect, it } from "vitest";
import { computeRequestHash } from "./idempotency-hash";

describe("computeRequestHash", () => {
  it("is deterministic for the same payload", () => {
    const payload = { polychrome: 320, boopon: 0 };
    expect(computeRequestHash(payload)).toBe(computeRequestHash(payload));
  });

  it("produces the SAME hash for payloads differing only in top-level key order", () => {
    const a = { polychrome: 320, monochrome: 0, boopon: 0 };
    const b = { boopon: 0, polychrome: 320, monochrome: 0 };
    expect(computeRequestHash(a)).toBe(computeRequestHash(b));
  });

  it("produces the SAME hash for payloads differing only in nested key order", () => {
    const a = { values: { sRankPity: 70, aRankPity: 2 }, expectedVersion: 3 };
    const b = { expectedVersion: 3, values: { aRankPity: 2, sRankPity: 70 } };
    expect(computeRequestHash(a)).toBe(computeRequestHash(b));
  });

  it("produces a DIFFERENT hash when a value actually differs", () => {
    const a = { polychrome: 320, boopon: 0 };
    const b = { polychrome: 321, boopon: 0 };
    expect(computeRequestHash(a)).not.toBe(computeRequestHash(b));
  });

  it("produces a DIFFERENT hash when expectedVersion differs, even with identical values", () => {
    const a = { polychrome: 320, expectedVersion: 3 };
    const b = { polychrome: 320, expectedVersion: 4 };
    expect(computeRequestHash(a)).not.toBe(computeRequestHash(b));
  });

  it("treats arrays order-sensitively (order is preserved, not sorted)", () => {
    const a = { items: [1, 2, 3] };
    const b = { items: [3, 2, 1] };
    expect(computeRequestHash(a)).not.toBe(computeRequestHash(b));
  });

  it("returns a 64-character hex SHA-256 digest", () => {
    expect(computeRequestHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
