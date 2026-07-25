import { describe, expect, it } from "vitest";
import { telegramAuthRequestSchema } from "./auth";

describe("telegramAuthRequestSchema", () => {
  it("accepts initData with a separate optional timezone field", () => {
    const result = telegramAuthRequestSchema.safeParse({
      initData: "auth_date=1&hash=abc&user=%7B%7D",
      timezone: "Europe/Berlin",
    });
    expect(result.success).toBe(true);
  });

  it("accepts initData without a timezone (server falls back to UTC)", () => {
    const result = telegramAuthRequestSchema.safeParse({ initData: "auth_date=1&hash=abc" });
    expect(result.success).toBe(true);
  });

  it("rejects a request with no initData at all", () => {
    const result = telegramAuthRequestSchema.safeParse({ timezone: "UTC" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty initData string — this is what a client outside Telegram legitimately sends (getRawInitData()), and it must reach resolveTelegramUser's dev-auth/MISSING_INIT_DATA branch, not be rejected here", () => {
    const result = telegramAuthRequestSchema.safeParse({ initData: "", timezone: "UTC" });
    expect(result.success).toBe(true);
  });

  it("rejects a request that tries to smuggle a userId/telegramId field", () => {
    const result = telegramAuthRequestSchema.safeParse({
      initData: "auth_date=1&hash=abc",
      userId: "11111111-1111-1111-1111-111111111111",
    });
    // .strict() must reject unknown keys outright — the server must never
    // even have the opportunity to read a client-supplied user identifier.
    expect(result.success).toBe(false);
  });

  it("rejects an oversized initData payload", () => {
    const result = telegramAuthRequestSchema.safeParse({
      initData: "a".repeat(9000),
    });
    expect(result.success).toBe(false);
  });
});
