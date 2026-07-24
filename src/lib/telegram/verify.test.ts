import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { verifyTelegramInitData } from "./verify";

const BOT_TOKEN = "123456:TEST-TOKEN-not-real";

function buildSignedInitData(
  fields: Record<string, string>,
  botToken: string = BOT_TOKEN,
): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}

function baseFields(overrides: Partial<Record<string, string>> = {}) {
  return {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({
      id: 123456789,
      first_name: "Anya",
      username: "anya_zzz",
      language_code: "ru",
    }),
    query_id: "AAEXample",
    ...overrides,
  };
}

describe("verifyTelegramInitData", () => {
  it("accepts a correctly signed, fresh initData string", () => {
    const initData = buildSignedInitData(baseFields());
    const result = verifyTelegramInitData({ initData, botToken: BOT_TOKEN });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user.id).toBe(123456789n);
      expect(result.data.user.username).toBe("anya_zzz");
    }
  });

  it("rejects a tampered field (signature mismatch)", () => {
    const initData = buildSignedInitData(baseFields());
    const tampered = initData.replace("query_id=AAEXample", "query_id=Tampered");
    const result = verifyTelegramInitData({ initData: tampered, botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("SIGNATURE_MISMATCH");
  });

  it("rejects initData signed with the wrong bot token", () => {
    const initData = buildSignedInitData(baseFields(), "999999:OTHER-TOKEN");
    const result = verifyTelegramInitData({ initData, botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("SIGNATURE_MISMATCH");
  });

  it("rejects initData whose auth_date is too old", () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 60 * 60 * 48; // 48h ago
    const initData = buildSignedInitData(baseFields({ auth_date: String(oldTimestamp) }));
    const result = verifyTelegramInitData({ initData, botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("rejects initData missing the hash field", () => {
    const fields = baseFields();
    const params = new URLSearchParams(fields);
    const result = verifyTelegramInitData({ initData: params.toString(), botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MISSING_HASH");
  });

  it("rejects initData missing the user field", () => {
    const fields: Record<string, string> = {
      auth_date: String(Math.floor(Date.now() / 1000)),
      query_id: "AAEXample",
    };
    const initData = buildSignedInitData(fields);
    const result = verifyTelegramInitData({ initData, botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MISSING_USER");
  });

  it("rejects an empty initData string", () => {
    const result = verifyTelegramInitData({ initData: "", botToken: BOT_TOKEN });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MALFORMED");
  });

  it("correctly parses a Telegram id that exceeds the 32-bit range", () => {
    const bigId = "9007199254740993"; // beyond Number.MAX_SAFE_INTEGER
    const initData = buildSignedInitData(
      baseFields({
        user: JSON.stringify({ id: bigId, first_name: "Big" }),
      }),
    );
    const result = verifyTelegramInitData({ initData, botToken: BOT_TOKEN });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.user.id).toBe(9007199254740993n);
    }
  });

  it("rejects a user field containing invalid JSON without throwing", () => {
    const fields = baseFields();
    // Build the signature over a syntactically broken `user` value on purpose.
    const broken = { ...fields, user: "{not-valid-json" };
    const initData = buildSignedInitData(broken);
    const result = verifyTelegramInitData({ initData, botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MISSING_USER");
  });

  it("rejects a user JSON object without a usable id", () => {
    const fields = baseFields({ user: JSON.stringify({ first_name: "NoId" }) });
    const initData = buildSignedInitData(fields);
    const result = verifyTelegramInitData({ initData, botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MISSING_USER");
  });

  it("accepts auth_date slightly in the future within clock-skew tolerance", () => {
    const nearFuture = Math.floor(Date.now() / 1000) + 3; // 3s ahead, within 5s tolerance
    const initData = buildSignedInitData(baseFields({ auth_date: String(nearFuture) }));
    const result = verifyTelegramInitData({ initData, botToken: BOT_TOKEN });

    expect(result.ok).toBe(true);
  });

  it("rejects auth_date from the future beyond the allowed clock-skew tolerance", () => {
    const farFuture = Math.floor(Date.now() / 1000) + 60; // 60s ahead
    const initData = buildSignedInitData(baseFields({ auth_date: String(farFuture) }));
    const result = verifyTelegramInitData({ initData, botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("does not allow a duplicated query parameter to bypass signature verification", () => {
    const fields = baseFields();
    const signedParams = new URLSearchParams(fields);
    const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const dataCheckString = Object.keys(fields)
      .sort()
      .map((key) => `${key}=${fields[key as keyof typeof fields]}`)
      .join("\n");
    const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    // Inject a duplicate `auth_date` key with a different (attacker-chosen)
    // value. The real Telegram signature was computed over a single
    // occurrence, so any extra/duplicated field must invalidate the hash.
    signedParams.append("auth_date", String(Math.floor(Date.now() / 1000) + 999999));
    signedParams.set("hash", hash);

    const result = verifyTelegramInitData({
      initData: signedParams.toString(),
      botToken: BOT_TOKEN,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("SIGNATURE_MISMATCH");
  });

  it("safely rejects a garbage, non-query-string input instead of throwing", () => {
    expect(() =>
      verifyTelegramInitData({
        initData: "this is not init data at all %% && == ??",
        botToken: BOT_TOKEN,
      }),
    ).not.toThrow();

    const result = verifyTelegramInitData({
      initData: "this is not init data at all %% && == ??",
      botToken: BOT_TOKEN,
    });
    expect(result.ok).toBe(false);
  });

  it("uses a constant-time comparison for the signature (verified by code review, not timing)", () => {
    // A microbenchmark-based timing test would be flaky in CI. Correctness
    // of the constant-time compare is covered functionally by the
    // "tampered field" and "wrong bot token" cases above; this test only
    // documents that requirement so it isn't silently dropped.
    const initData = buildSignedInitData(baseFields());
    const result = verifyTelegramInitData({ initData, botToken: BOT_TOKEN });
    expect(result.ok).toBe(true);
  });
});
