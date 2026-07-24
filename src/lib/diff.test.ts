import { describe, expect, it } from "vitest";
import { computeFieldDiff, hasAnyChange } from "./diff";

describe("computeFieldDiff", () => {
  it("returns no changes for identical objects", () => {
    expect(computeFieldDiff({ a: 1, b: 2 }, { a: 1, b: 2 })).toEqual([]);
  });

  it("returns only the fields that actually changed", () => {
    const diff = computeFieldDiff({ a: 1, b: 2, c: 3 }, { a: 1, b: 5, c: 3 });
    expect(diff).toEqual([{ field: "b", previous: 2, next: 5 }]);
  });

  it("detects boolean changes", () => {
    const diff = computeFieldDiff({ active: false }, { active: true });
    expect(diff).toEqual([{ field: "active", previous: false, next: true }]);
  });

  it("detects multiple changed fields, in the order of `next`'s keys", () => {
    const diff = computeFieldDiff({ a: 1, b: 2 }, { a: 9, b: 9 });
    expect(diff.map((c) => c.field)).toEqual(["a", "b"]);
  });
});

describe("hasAnyChange", () => {
  it("is false when nothing changed", () => {
    expect(hasAnyChange({ a: 1 }, { a: 1 })).toBe(false);
  });

  it("is true when at least one field changed", () => {
    expect(hasAnyChange({ a: 1 }, { a: 2 })).toBe(true);
  });
});
