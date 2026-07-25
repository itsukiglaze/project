import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAuthenticateWithTelegramLoginWidget = vi.fn();

const { MockLoginWidgetAuthError } = vi.hoisted(() => {
  class MockLoginWidgetAuthError extends Error {
    constructor(public readonly code: string) {
      super(code);
      this.name = "LoginWidgetAuthError";
    }
  }
  return { MockLoginWidgetAuthError };
});

vi.mock("@/server/services/auth-service", () => ({
  authenticateWithTelegramLoginWidget: (...args: unknown[]) =>
    mockAuthenticateWithTelegramLoginWidget(...args),
  LoginWidgetAuthError: MockLoginWidgetAuthError,
}));

import { POST } from "./route";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    id: "111222333",
    first_name: "Anya",
    username: "anya_zzz",
    auth_date: String(Math.floor(Date.now() / 1000)),
    hash: "a".repeat(64),
    nonce: "test-nonce-value",
    timezone: "Europe/Berlin",
    ...overrides,
  };
}

function req(body: unknown, cookieHeader?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookieHeader) headers.cookie = cookieHeader;
  return new NextRequest("https://example.com/api/auth/telegram-login/verify", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/auth/telegram-login/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a session and sets the session cookie on success (200)", async () => {
    mockAuthenticateWithTelegramLoginWidget.mockResolvedValue({
      userId: "user-1",
      session: { rawToken: "raw-session-token", expiresAt: new Date(Date.now() + 1000) },
    });

    const response = await POST(req(validBody(), "ppp_login_nonce=nonce.123.sig"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);

    const sessionCookie = response.cookies.get("ppp_session");
    expect(sessionCookie?.value).toBe("raw-session-token");
  });

  it("clears the nonce cookie on success — it must never be reusable", async () => {
    mockAuthenticateWithTelegramLoginWidget.mockResolvedValue({
      userId: "user-1",
      session: { rawToken: "raw-session-token", expiresAt: new Date(Date.now() + 1000) },
    });

    const response = await POST(req(validBody(), "ppp_login_nonce=nonce.123.sig"));
    const nonceCookie = response.cookies.get("ppp_login_nonce");
    expect(nonceCookie?.value).toBe("");
  });

  it("maps CSRF_REJECTED to 403 and still clears the nonce cookie", async () => {
    const { LoginWidgetAuthError } = await import("@/server/services/auth-service");
    mockAuthenticateWithTelegramLoginWidget.mockRejectedValue(new LoginWidgetAuthError("CSRF_REJECTED"));

    const response = await POST(req(validBody()));
    expect(response.status).toBe(403);
    const nonceCookie = response.cookies.get("ppp_login_nonce");
    expect(nonceCookie?.value).toBe("");
  });

  it("maps SIGNATURE_MISMATCH to 401", async () => {
    const { LoginWidgetAuthError } = await import("@/server/services/auth-service");
    mockAuthenticateWithTelegramLoginWidget.mockRejectedValue(
      new LoginWidgetAuthError("SIGNATURE_MISMATCH"),
    );

    const response = await POST(req(validBody()));
    expect(response.status).toBe(401);
  });

  it("maps SERVER_MISCONFIGURED to 500", async () => {
    const { LoginWidgetAuthError } = await import("@/server/services/auth-service");
    mockAuthenticateWithTelegramLoginWidget.mockRejectedValue(
      new LoginWidgetAuthError("SERVER_MISCONFIGURED"),
    );

    const response = await POST(req(validBody()));
    expect(response.status).toBe(500);
  });

  it("400s on malformed JSON", async () => {
    const response = await POST(req("{not valid json"));
    expect(response.status).toBe(400);
    expect(mockAuthenticateWithTelegramLoginWidget).not.toHaveBeenCalled();
  });

  it("400s and rejects an unknown field (strict schema) — e.g. an attempt to smuggle a userId", async () => {
    const response = await POST(req(validBody({ userId: "someone-else" })));
    expect(response.status).toBe(400);
    expect(mockAuthenticateWithTelegramLoginWidget).not.toHaveBeenCalled();
  });

  it("400s when required fields (id, auth_date, hash, nonce) are missing", async () => {
    const body = validBody() as Record<string, unknown>;
    delete body.hash;
    const response = await POST(req(body));
    expect(response.status).toBe(400);
    expect(mockAuthenticateWithTelegramLoginWidget).not.toHaveBeenCalled();
  });

  it("passes the raw cookie value from the request through to the service, not a parsed/decoded one", async () => {
    mockAuthenticateWithTelegramLoginWidget.mockResolvedValue({
      userId: "user-1",
      session: { rawToken: "raw-session-token", expiresAt: new Date(Date.now() + 1000) },
    });

    await POST(req(validBody({ nonce: "abc" }), "ppp_login_nonce=nonceval.999.sigval"));
    expect(mockAuthenticateWithTelegramLoginWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedNonce: "abc",
        nonceCookieValue: "nonceval.999.sigval",
      }),
    );
  });

  it("500s and logs on an unexpected (non-LoginWidgetAuthError) failure", async () => {
    mockAuthenticateWithTelegramLoginWidget.mockRejectedValue(new Error("db exploded"));
    const response = await POST(req(validBody()));
    expect(response.status).toBe(500);
  });
});
