import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  safeCompareHashes,
} from "./session-token";

describe("session-token", () => {
  it("generates tokens with sufficient entropy (256 bits, base64url)", () => {
    const token = generateSessionToken();
    // 32 raw bytes -> 43 base64url chars (no padding).
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates a different token on every call", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSessionToken()));
    expect(tokens.size).toBe(50);
  });

  it("hashes deterministically — same input always yields the same hash", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("the raw token is never equal to its own hash", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it("produces a 64-character hex SHA-256 digest", () => {
    const hash = hashSessionToken("some-token-value");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a correct token matches its stored hash", () => {
    const token = generateSessionToken();
    const storedHash = hashSessionToken(token);
    expect(safeCompareHashes(hashSessionToken(token), storedHash)).toBe(true);
  });

  it("an incorrect token does not match a stored hash", () => {
    const storedHash = hashSessionToken(generateSessionToken());
    const wrongHash = hashSessionToken(generateSessionToken());
    expect(safeCompareHashes(wrongHash, storedHash)).toBe(false);
  });

  it("safely handles hashes of different lengths without throwing", () => {
    expect(safeCompareHashes("ab", hashSessionToken("x"))).toBe(false);
  });
});
