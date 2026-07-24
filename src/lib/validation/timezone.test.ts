import { describe, expect, it } from "vitest";
import { isValidIanaTimezone, normalizeTimezone, FALLBACK_TIMEZONE } from "./timezone";

describe("timezone validation", () => {
  it("accepts a well-known IANA zone", () => {
    expect(isValidIanaTimezone("Europe/Berlin")).toBe(true);
    expect(isValidIanaTimezone("Asia/Tokyo")).toBe(true);
  });

  it("rejects a bogus zone name", () => {
    expect(isValidIanaTimezone("Not/AZone")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isValidIanaTimezone(undefined)).toBe(false);
    expect(isValidIanaTimezone(123)).toBe(false);
    expect(isValidIanaTimezone(null)).toBe(false);
  });

  it("falls back to UTC for invalid input instead of throwing", () => {
    expect(normalizeTimezone("garbage")).toBe(FALLBACK_TIMEZONE);
    expect(normalizeTimezone(undefined)).toBe(FALLBACK_TIMEZONE);
  });

  it("passes through a valid zone unchanged", () => {
    expect(normalizeTimezone("Europe/Berlin")).toBe("Europe/Berlin");
  });
});
