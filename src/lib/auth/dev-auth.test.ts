import { afterEach, describe, expect, it, vi } from "vitest";
import { getDevAuthUser, isDevAuthEnabled } from "./dev-auth";

describe("dev-auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled when NODE_ENV=production, regardless of DEV_AUTH_ENABLED", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_AUTH_ENABLED", "true");
    vi.stubEnv("DEV_TELEGRAM_USER_ID", "42");

    expect(isDevAuthEnabled()).toBe(false);
    expect(getDevAuthUser()).toBeNull();
  });

  it("is disabled when DEV_AUTH_ENABLED is not exactly 'true', even in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_ENABLED", "false");
    vi.stubEnv("DEV_TELEGRAM_USER_ID", "42");
    expect(getDevAuthUser()).toBeNull();

    vi.stubEnv("DEV_AUTH_ENABLED", "1");
    expect(getDevAuthUser()).toBeNull();

    vi.stubEnv("DEV_AUTH_ENABLED", "");
    expect(getDevAuthUser()).toBeNull();
  });

  it("is enabled only when both NODE_ENV=development AND DEV_AUTH_ENABLED=true", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_ENABLED", "true");
    vi.stubEnv("DEV_TELEGRAM_USER_ID", "555000111");

    expect(isDevAuthEnabled()).toBe(true);
    const user = getDevAuthUser();
    expect(user).not.toBeNull();
    expect(user?.telegramId).toBe(555000111n);
  });

  it("returns null when enabled but DEV_TELEGRAM_USER_ID is missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_ENABLED", "true");
    vi.stubEnv("DEV_TELEGRAM_USER_ID", "");

    expect(getDevAuthUser()).toBeNull();
  });

  it("returns null when DEV_TELEGRAM_USER_ID is not a valid integer", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_ENABLED", "true");
    vi.stubEnv("DEV_TELEGRAM_USER_ID", "not-a-number");

    expect(getDevAuthUser()).toBeNull();
  });

  it("has zero parameters (auxiliary signature check only)", () => {
    // This only guards against an accidental future edit adding a
    // parameter — it is NOT the safety guarantee itself. The actual
    // guarantees that make dev-auth safe are architectural, verified by the
    // tests above plus static review, not by this arity check:
    //   - the module imports "server-only", so it cannot end up in a
    //     client bundle;
    //   - it is enabled only when NODE_ENV=development AND
    //     DEV_AUTH_ENABLED=true both hold (tested above);
    //   - the Telegram id always comes from the server's own
    //     DEV_TELEGRAM_USER_ID env var, never from request input (tested
    //     above via the "no arguments" API shape, but enforced by the
    //     absence of any request-reading code in this module — see
    //     src/lib/auth/dev-auth.ts and its caller in
    //     src/server/services/auth-service.ts, which only reaches this
    //     branch when initData is absent, and never forwards request
    //     body/query/header/cookie values into it);
    //   - the production API route (POST /api/auth/telegram) has no code
    //     path that reads a client-supplied user id at all — see
    //     src/app/api/auth/telegram/route.ts and
    //     src/lib/validation/auth.ts (`.strict()` Zod schema with only
    //     `initData` and `timezone`).
    expect(getDevAuthUser.length).toBe(0);
  });
});
