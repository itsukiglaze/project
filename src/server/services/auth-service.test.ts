import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "crypto";

const mockUpsertUserFromTelegram = vi.fn();
const mockCreateSession = vi.fn();

vi.mock("@/server/repositories/user-repository", () => ({
  upsertUserFromTelegram: (...args: unknown[]) => mockUpsertUserFromTelegram(...args),
}));
vi.mock("@/server/repositories/session-repository", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
}));

import {
  authenticateWithTelegram,
  authenticateWithTelegramLoginWidget,
  AuthError,
  LoginWidgetAuthError,
} from "./auth-service";
import { mintLoginNonce } from "@/lib/auth/login-nonce";

const BOT_TOKEN = "123456:TEST-TOKEN-not-real";
const SESSION_SECRET = "test-session-secret-not-real";

function buildSignedInitData(fields: Record<string, string>, botToken: string = BOT_TOKEN): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

function baseInitDataFields(overrides: Partial<Record<string, string>> = {}) {
  return {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 111222333, first_name: "Anya", username: "anya_zzz" }),
    ...overrides,
  };
}

function signLoginWidgetFields(
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

function baseLoginWidgetPayload(overrides: Partial<Record<string, string>> = {}) {
  const fields = {
    id: "111222333",
    first_name: "Anya",
    username: "anya_zzz",
    auth_date: String(Math.floor(Date.now() / 1000)),
    ...overrides,
  };
  return { ...fields, hash: signLoginWidgetFields(fields) };
}

describe("authenticateWithTelegram (Mini App initData)", () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    mockUpsertUserFromTelegram.mockResolvedValue({ id: "user-1" });
    mockCreateSession.mockResolvedValue({ rawToken: "raw-token", expiresAt: new Date() });
  });

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    vi.unstubAllEnvs();
  });

  it("authenticates and creates a session for valid, correctly signed initData", async () => {
    const initData = buildSignedInitData(baseInitDataFields());
    const result = await authenticateWithTelegram({ initData, timezone: "Europe/Berlin" });

    expect(result.userId).toBe("user-1");
    expect(result.session.rawToken).toBe("raw-token");
    expect(mockUpsertUserFromTelegram).toHaveBeenCalledTimes(1);
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid (tampered) initData without creating a session", async () => {
    const initData = buildSignedInitData(baseInitDataFields()).replace("Anya", "Tampered");

    await expect(authenticateWithTelegram({ initData, timezone: "UTC" })).rejects.toThrow(AuthError);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("rejects when TELEGRAM_BOT_TOKEN is not configured", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const initData = buildSignedInitData(baseInitDataFields());

    await expect(authenticateWithTelegram({ initData, timezone: "UTC" })).rejects.toMatchObject({
      code: "SERVER_MISCONFIGURED",
    });
  });

  it("rejects empty initData in production with no dev-auth fallback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(authenticateWithTelegram({ initData: "", timezone: "UTC" })).rejects.toMatchObject({
      code: "MISSING_INIT_DATA",
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});

describe("authenticateWithTelegramLoginWidget (browser fallback)", () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    process.env.SESSION_SECRET = SESSION_SECRET;
    mockUpsertUserFromTelegram.mockResolvedValue({ id: "user-1" });
    mockCreateSession.mockResolvedValue({ rawToken: "raw-token", expiresAt: new Date() });
  });

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    process.env.SESSION_SECRET = originalSecret;
  });

  it("authenticates and creates a session for a valid payload with a matching nonce", async () => {
    const minted = mintLoginNonce(SESSION_SECRET);
    const payload = baseLoginWidgetPayload();

    const result = await authenticateWithTelegramLoginWidget({
      payload,
      submittedNonce: minted.nonce,
      nonceCookieValue: minted.cookieValue,
      timezone: "Europe/Berlin",
    });

    expect(result.userId).toBe("user-1");
    expect(mockUpsertUserFromTelegram).toHaveBeenCalledTimes(1);
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });

  it("rejects a valid Telegram signature when the nonce doesn't match (CSRF defense)", async () => {
    const minted = mintLoginNonce(SESSION_SECRET);
    const payload = baseLoginWidgetPayload();

    await expect(
      authenticateWithTelegramLoginWidget({
        payload,
        submittedNonce: "wrong-nonce-value",
        nonceCookieValue: minted.cookieValue,
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ code: "CSRF_REJECTED" });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("rejects when the nonce cookie is missing entirely (no prior page load)", async () => {
    const payload = baseLoginWidgetPayload();

    await expect(
      authenticateWithTelegramLoginWidget({
        payload,
        submittedNonce: "some-nonce",
        nonceCookieValue: undefined,
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ code: "CSRF_REJECTED" });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("rejects an invalid (tampered) Telegram signature even with a valid nonce", async () => {
    const minted = mintLoginNonce(SESSION_SECRET);
    const payload = baseLoginWidgetPayload();
    payload.first_name = "Tampered";

    await expect(
      authenticateWithTelegramLoginWidget({
        payload,
        submittedNonce: minted.nonce,
        nonceCookieValue: minted.cookieValue,
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ code: "SIGNATURE_MISMATCH" });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("rejects when SESSION_SECRET is not configured", async () => {
    delete process.env.SESSION_SECRET;
    const payload = baseLoginWidgetPayload();

    await expect(
      authenticateWithTelegramLoginWidget({
        payload,
        submittedNonce: "any-nonce",
        nonceCookieValue: "any.cookie.value",
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ code: "SERVER_MISCONFIGURED" });
  });

  it("rejects when TELEGRAM_BOT_TOKEN is not configured", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const minted = mintLoginNonce(SESSION_SECRET);
    const payload = baseLoginWidgetPayload();

    await expect(
      authenticateWithTelegramLoginWidget({
        payload,
        submittedNonce: minted.nonce,
        nonceCookieValue: minted.cookieValue,
        timezone: "UTC",
      }),
    ).rejects.toMatchObject({ code: "SERVER_MISCONFIGURED" });
  });

  it("throws LoginWidgetAuthError instances specifically, not generic AuthError", async () => {
    const minted = mintLoginNonce(SESSION_SECRET);
    const payload = baseLoginWidgetPayload();
    payload.hash = "0".repeat(64);

    try {
      await authenticateWithTelegramLoginWidget({
        payload,
        submittedNonce: minted.nonce,
        nonceCookieValue: minted.cookieValue,
        timezone: "UTC",
      });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LoginWidgetAuthError);
    }
  });
});
