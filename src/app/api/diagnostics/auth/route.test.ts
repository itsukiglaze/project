import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

function req(body: unknown) {
  return new NextRequest("https://example.com/api/diagnostics/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    platform: "android",
    webAppVersion: "7.10",
    initDataPresent: false,
    launchPath: "webapp_empty_init_data",
    authFailureCategory: "EMPTY_INIT_DATA",
    ...overrides,
  };
}

describe("POST /api/diagnostics/auth", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it("accepts a well-formed diagnostic event (200)", async () => {
    const response = await POST(req(validBody()));
    expect(response.status).toBe(200);
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
  });

  it("logs only the allow-listed fields, nothing else", async () => {
    await POST(req(validBody()));
    const loggedJson = consoleInfoSpy.mock.calls[0][1] as string;
    const logged = JSON.parse(loggedJson);
    expect(Object.keys(logged).sort()).toEqual(
      ["authFailureCategory", "initDataPresent", "launchPath", "platform", "webAppVersion"].sort(),
    );
  });

  it("400s and does not log when an unknown field is present (e.g. an attempt to smuggle initData/hash/user payload)", async () => {
    const response = await POST(req({ ...validBody(), initData: "leaked-secret-payload" }));
    expect(response.status).toBe(400);
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  it("400s on an invalid launchPath enum value", async () => {
    const response = await POST(req(validBody({ launchPath: "not-a-real-path" })));
    expect(response.status).toBe(400);
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  it("400s on malformed JSON", async () => {
    const response = await POST(req("{not valid json"));
    expect(response.status).toBe(400);
  });

  it("accepts null platform/webAppVersion/authFailureCategory (ordinary browser, no Telegram at all)", async () => {
    const response = await POST(
      req(validBody({ platform: null, webAppVersion: null, authFailureCategory: null, launchPath: "no_webapp" })),
    );
    expect(response.status).toBe(200);
  });

  it("413s on an oversized body", async () => {
    const response = await POST(
      new NextRequest("https://example.com/api/diagnostics/auth", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": String(3 * 1024) },
        body: JSON.stringify(validBody()),
      }),
    );
    expect(response.status).toBe(413);
  });
});
