import { describe, expect, it } from "vitest";
import { createHash, createHmac } from "crypto";
import { verifyTelegramLoginWidget, type TelegramLoginWidgetPayload } from "./verify-login-widget";

const BOT_TOKEN = "123456:TEST-TOKEN-not-real";

function signPayload(
  fields: Record<string, string | undefined>,
  botToken: string = BOT_TOKEN,
): string {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined) as [string, string][];
  const dataCheckString = entries
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = createHash("sha256").update(botToken).digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

function basePayload(overrides: Partial<TelegramLoginWidgetPayload> = {}): TelegramLoginWidgetPayload {
  const fields: TelegramLoginWidgetPayload = {
    id: "123456789",
    first_name: "Anya",
    username: "anya_zzz",
    auth_date: String(Math.floor(Date.now() / 1000)),
    hash: "placeholder",
    ...overrides,
  };
  const { hash: _hash, ...unsigned } = fields;
  void _hash;
  fields.hash = signPayload(unsigned);
  return fields;
}

describe("verifyTelegramLoginWidget", () => {
  it("accepts a correctly signed, fresh login-widget payload", () => {
    const payload = basePayload();
    const result = verifyTelegramLoginWidget({ payload, botToken: BOT_TOKEN });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(123456789n);
      expect(result.data.username).toBe("anya_zzz");
    }
  });

  it("rejects a tampered field (signature mismatch)", () => {
    const payload = basePayload();
    payload.first_name = "Tampered";
    const result = verifyTelegramLoginWidget({ payload, botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("SIGNATURE_MISMATCH");
  });

  it("rejects a payload signed with the wrong bot token", () => {
    const payload = basePayload();
    const wrongHash = signPayload(
      { id: payload.id, first_name: payload.first_name, username: payload.username, auth_date: payload.auth_date },
      "999999:OTHER-TOKEN",
    );
    const result = verifyTelegramLoginWidget({
      payload: { ...payload, hash: wrongHash },
      botToken: BOT_TOKEN,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("SIGNATURE_MISMATCH");
  });

  it("rejects a payload whose auth_date is too old", () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 60 * 60 * 48; // 48h ago
    const payload = basePayload({ auth_date: String(oldTimestamp) });
    const result = verifyTelegramLoginWidget({ payload, botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("rejects a payload missing the hash field", () => {
    const payload = basePayload();
    const result = verifyTelegramLoginWidget({
      payload: { ...payload, hash: "" },
      botToken: BOT_TOKEN,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MISSING_HASH");
  });

  it("rejects a payload missing id", () => {
    const payload = basePayload();
    const result = verifyTelegramLoginWidget({
      payload: { ...payload, id: "" },
      botToken: BOT_TOKEN,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MISSING_ID");
  });

  it("accepts auth_date slightly in the future within clock-skew tolerance", () => {
    const nearFuture = Math.floor(Date.now() / 1000) + 3;
    const payload = basePayload({ auth_date: String(nearFuture) });
    const result = verifyTelegramLoginWidget({ payload, botToken: BOT_TOKEN });

    expect(result.ok).toBe(true);
  });

  it("rejects auth_date from the future beyond the allowed clock-skew tolerance", () => {
    const farFuture = Math.floor(Date.now() / 1000) + 60;
    const payload = basePayload({ auth_date: String(farFuture) });
    const result = verifyTelegramLoginWidget({ payload, botToken: BOT_TOKEN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("correctly parses a Telegram id that exceeds the 32-bit range", () => {
    const bigId = "9007199254740993";
    const payload = basePayload({ id: bigId });
    const result = verifyTelegramLoginWidget({ payload, botToken: BOT_TOKEN });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(9007199254740993n);
  });

  it("uses a different secret-key derivation than the Mini App initData algorithm (SHA256(token), not HMAC('WebAppData', token))", () => {
    // A hash computed with the Mini App's secret-key derivation must NOT
    // validate against the Login Widget verifier — proves the two
    // protocols are not accidentally cross-compatible/confusable.
    const fields = {
      id: "123456789",
      first_name: "Anya",
      username: "anya_zzz",
      auth_date: String(Math.floor(Date.now() / 1000)),
    };
    const dataCheckString = Object.keys(fields)
      .sort()
      .map((k) => `${k}=${fields[k as keyof typeof fields]}`)
      .join("\n");
    const miniAppSecretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const miniAppStyleHash = createHmac("sha256", miniAppSecretKey).update(dataCheckString).digest("hex");

    const result = verifyTelegramLoginWidget({
      payload: { ...fields, hash: miniAppStyleHash },
      botToken: BOT_TOKEN,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("SIGNATURE_MISMATCH");
  });
});
