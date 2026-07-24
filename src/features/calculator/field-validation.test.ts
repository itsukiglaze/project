import { describe, expect, it } from "vitest";
import { parseNonNegativeInt, parsePity, parseTargetCopies } from "./field-validation";

describe("parseNonNegativeInt", () => {
  it("6. rejects a negative-looking value", () => {
    // Text fields only ever accept digit characters (see NumericField), but
    // the parser itself must also reject a negative value defensively.
    expect(parseNonNegativeInt("-5").ok).toBe(false);
  });

  it("7. rejects a fractional value", () => {
    expect(parseNonNegativeInt("1.5").ok).toBe(false);
  });

  it("rejects an empty string rather than defaulting to 0", () => {
    expect(parseNonNegativeInt("").ok).toBe(false);
  });

  it("accepts a plain non-negative integer", () => {
    const result = parseNonNegativeInt("160");
    expect(result).toEqual({ ok: true, value: 160 });
  });

  it("rejects a value above the given max", () => {
    expect(parseNonNegativeInt("1000", 100).ok).toBe(false);
  });
});

describe("parsePity", () => {
  it("rejects pity equal to hard pity", () => {
    expect(parsePity("90", 90).ok).toBe(false);
  });

  it("accepts pity one below hard pity", () => {
    expect(parsePity("89", 90)).toEqual({ ok: true, value: 89 });
  });
});

describe("parseTargetCopies", () => {
  it("8. rejects an empty targetCopies value", () => {
    expect(parseTargetCopies("").ok).toBe(false);
  });

  it("8. rejects targetCopies = 0", () => {
    expect(parseTargetCopies("0").ok).toBe(false);
  });

  it("accepts targetCopies = 1", () => {
    expect(parseTargetCopies("1")).toEqual({ ok: true, value: 1 });
  });
});
