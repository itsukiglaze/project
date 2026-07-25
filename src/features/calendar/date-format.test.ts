import { describe, expect, it } from "vitest";
import { formatHumanDate } from "./date-format";

describe("formatHumanDate", () => {
  it("formats as 'day genitive-month' without a year by default", () => {
    expect(formatHumanDate({ year: 2026, month: 7, day: 25 })).toBe("25 июля");
  });

  it("includes the year when includeYear is true", () => {
    expect(formatHumanDate({ year: 2026, month: 8, day: 24 }, true)).toBe("24 августа 2026");
  });

  it("uses the correct genitive form for January (edge of the month table)", () => {
    expect(formatHumanDate({ year: 2026, month: 1, day: 1 })).toBe("1 января");
  });

  it("uses the correct genitive form for December (edge of the month table)", () => {
    expect(formatHumanDate({ year: 2026, month: 12, day: 31 })).toBe("31 декабря");
  });
});
