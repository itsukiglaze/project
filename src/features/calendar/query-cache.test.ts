import { describe, expect, it } from "vitest";
import { CALENDAR_QUERY_KEYS } from "./query-cache";

describe("CALENDAR_QUERY_KEYS", () => {
  it("query key builders produce the expected stable strings", () => {
    expect(CALENDAR_QUERY_KEYS.occurrences("2026-01-01", "2026-01-31")).toBe(
      "occurrences:2026-01-01:2026-01-31",
    );
    expect(CALENDAR_QUERY_KEYS.forecast(30)).toBe("forecast:30");
  });
});
