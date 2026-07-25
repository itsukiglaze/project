import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/auth/telegram-login/nonce", () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-not-real";
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("503s when SESSION_SECRET is not configured — fails closed, never falls open", async () => {
    delete process.env.SESSION_SECRET;
    const response = await GET();
    expect(response.status).toBe(503);
  });

  it("mints a nonce and sets an HttpOnly cookie (200)", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.nonce).toBe("string");
    expect(body.nonce.length).toBeGreaterThan(0);

    const cookie = response.cookies.get("ppp_login_nonce");
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
  });

  it("mints a different nonce on each call", async () => {
    const first = await (await GET()).json();
    const second = await (await GET()).json();
    expect(first.nonce).not.toBe(second.nonce);
  });
});
