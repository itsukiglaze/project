import { describe, expect, it } from "vitest";
import { getTodayInTimezone, getTodayInTimezoneOrUtc } from "./local-date";

describe("getTodayInTimezone", () => {
  it("returns a well-formed LocalDate for a valid IANA timezone", () => {
    const today = getTodayInTimezone("Europe/Berlin");
    expect(today.year).toBeGreaterThan(2000);
    expect(today.month).toBeGreaterThanOrEqual(1);
    expect(today.month).toBeLessThanOrEqual(12);
    expect(today.day).toBeGreaterThanOrEqual(1);
    expect(today.day).toBeLessThanOrEqual(31);
  });

  it("throws for an invalid timezone", () => {
    expect(() => getTodayInTimezone("Not/A_Real_Zone")).toThrow();
  });
});

describe("getTodayInTimezoneOrUtc", () => {
  it("returns the same result as getTodayInTimezone for a valid timezone", () => {
    expect(getTodayInTimezoneOrUtc("Europe/Berlin")).toEqual(getTodayInTimezone("Europe/Berlin"));
  });

  it("falls back to UTC for an invalid timezone instead of throwing", () => {
    expect(() => getTodayInTimezoneOrUtc("Not/A_Real_Zone")).not.toThrow();
    expect(getTodayInTimezoneOrUtc("Not/A_Real_Zone")).toEqual(getTodayInTimezone("UTC"));
  });
});
