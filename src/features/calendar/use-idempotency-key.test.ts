// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIdempotencyKey } from "./use-idempotency-key";

describe("useIdempotencyKey", () => {
  it("returns the same key for the same payload (retry of the same action)", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const key1 = result.current.getKey({ amount: 100 });
    const key2 = result.current.getKey({ amount: 100 });
    expect(key1).toBe(key2);
  });

  it("returns a NEW key when the payload changes (a genuinely new action)", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const key1 = result.current.getKey({ amount: 100 });
    const key2 = result.current.getKey({ amount: 200 });
    expect(key1).not.toBe(key2);
  });

  it("reset() clears history, so the next call always mints a fresh key", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const key1 = result.current.getKey({ amount: 100 });
    result.current.reset();
    const key2 = result.current.getKey({ amount: 100 }); // same payload, but reset in between
    expect(key1).not.toBe(key2);
  });

  it("produces a plausible unique-looking key format", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const key = result.current.getKey({ a: 1 });
    expect(key.length).toBeGreaterThanOrEqual(8);
  });
});
