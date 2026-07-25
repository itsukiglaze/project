// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { TelegramLaunchState } from "@/lib/telegram/webapp";

const mockWaitForTelegramLaunch = vi.fn<() => Promise<TelegramLaunchState>>();
const mockInitTelegramWebApp = vi.fn();
const mockSnapshotTelegramEnvironment = vi.fn();
const mockReportAuthDiagnostic = vi.fn();

vi.mock("@/lib/telegram/webapp", () => ({
  initTelegramWebApp: () => mockInitTelegramWebApp(),
  waitForTelegramLaunch: () => mockWaitForTelegramLaunch(),
  getClientTimezone: () => "Europe/Berlin",
}));
vi.mock("@/lib/telegram/diagnostics", () => ({
  snapshotTelegramEnvironment: () => mockSnapshotTelegramEnvironment(),
}));
vi.mock("@/lib/telegram/diagnostics-log", () => ({
  reportAuthDiagnostic: (event: unknown) => mockReportAuthDiagnostic(event),
}));

import { AuthProvider, useAuth } from "./auth-provider";

function TestConsumer() {
  const { status, user, errorCode, authFailureCategory, launchPath } = useAuth();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="user">{user?.firstName ?? ""}</div>
      <div data-testid="errorCode">{errorCode ?? ""}</div>
      <div data-testid="category">{authFailureCategory ?? ""}</div>
      <div data-testid="launchPath">{launchPath ?? ""}</div>
    </div>
  );
}

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  mockSnapshotTelegramEnvironment.mockReturnValue({
    webAppPresent: false,
    initDataPresent: false,
    version: null,
    platform: null,
    initDataUnsafePresent: false,
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetchSequence(
  handlers: Record<string, () => { ok: boolean; json: () => Promise<unknown> }>,
) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    for (const [path, handler] of Object.entries(handlers)) {
      if (url.includes(path)) return Promise.resolve(handler());
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as unknown as typeof fetch;
}

describe("AuthProvider — valid initData (real WebApp, ordinary success)", () => {
  it("authenticates and exposes the current user", async () => {
    mockWaitForTelegramLaunch.mockResolvedValue({ kind: "webapp", initData: "auth_date=1&hash=abc" });
    mockFetchSequence({
      "/api/auth/telegram": () => ({ ok: true, json: async () => ({ ok: true }) }),
      "/api/me": () => ({
        ok: true,
        json: async () => ({ id: "u1", firstName: "Anya", timezone: "Europe/Berlin" }),
      }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("Anya");
    expect(screen.getByTestId("launchPath")).toHaveTextContent("webapp");
  });

  it("reports a success diagnostic with no failure category", async () => {
    mockWaitForTelegramLaunch.mockResolvedValue({ kind: "webapp", initData: "auth_date=1&hash=abc" });
    mockFetchSequence({
      "/api/auth/telegram": () => ({ ok: true, json: async () => ({ ok: true }) }),
      "/api/me": () => ({ ok: true, json: async () => ({ id: "u1", timezone: "UTC" }) }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(mockReportAuthDiagnostic).toHaveBeenCalled());
    expect(mockReportAuthDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ launchPath: "webapp", authFailureCategory: null }),
    );
  });
});

describe("AuthProvider — invalid initData (server rejects the signature)", () => {
  it("categorizes a SIGNATURE_MISMATCH server response as INIT_DATA_REJECTED", async () => {
    mockWaitForTelegramLaunch.mockResolvedValue({ kind: "webapp", initData: "tampered" });
    mockFetchSequence({
      "/api/auth/telegram": () => ({
        ok: false,
        json: async () => ({ error: { code: "SIGNATURE_MISMATCH" } }),
      }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(screen.getByTestId("category")).toHaveTextContent("INIT_DATA_REJECTED");
    expect(screen.getByTestId("errorCode")).toHaveTextContent("SIGNATURE_MISMATCH");
  });
});

describe("AuthProvider — Telegram WebApp present but initData stays empty (AyuGram symptom)", () => {
  it("shows the EMPTY_INIT_DATA category without ever calling the server auth endpoint", async () => {
    mockWaitForTelegramLaunch.mockResolvedValue({ kind: "webapp_empty_init_data" });
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(screen.getByTestId("category")).toHaveTextContent("EMPTY_INIT_DATA");
    // The auth endpoint is never called for this case — the server can't
    // tell "WebApp present but empty" apart from "no WebApp at all"
    // (both send empty initData), and the client already has the more
    // specific answer.
    expect(fetchSpy).not.toHaveBeenCalledWith("/api/auth/telegram", expect.anything());
  });

  it("reports the EMPTY_INIT_DATA diagnostic", async () => {
    mockWaitForTelegramLaunch.mockResolvedValue({ kind: "webapp_empty_init_data" });
    mockSnapshotTelegramEnvironment.mockReturnValue({
      webAppPresent: true,
      initDataPresent: false,
      version: "7.2",
      platform: "android",
      initDataUnsafePresent: false,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(mockReportAuthDiagnostic).toHaveBeenCalled());
    expect(mockReportAuthDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        launchPath: "webapp_empty_init_data",
        authFailureCategory: "EMPTY_INIT_DATA",
        platform: "android",
        webAppVersion: "7.2",
      }),
    );
  });
});

describe("AuthProvider — ordinary browser (no WebApp at all)", () => {
  it("still calls the server with empty initData, and MISSING_INIT_DATA becomes NO_TELEGRAM", async () => {
    mockWaitForTelegramLaunch.mockResolvedValue({ kind: "no_webapp" });
    mockFetchSequence({
      "/api/auth/telegram": () => ({
        ok: false,
        json: async () => ({ error: { code: "MISSING_INIT_DATA" } }),
      }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(screen.getByTestId("category")).toHaveTextContent("NO_TELEGRAM");
  });
});

describe("AuthProvider — backend/database failure", () => {
  it("categorizes an unrecognized/internal server error as BACKEND_ERROR", async () => {
    mockWaitForTelegramLaunch.mockResolvedValue({ kind: "webapp", initData: "auth_date=1&hash=abc" });
    mockFetchSequence({
      "/api/auth/telegram": () => ({
        ok: false,
        json: async () => ({ error: { code: "INTERNAL_ERROR" } }),
      }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(screen.getByTestId("category")).toHaveTextContent("BACKEND_ERROR");
  });

  it("categorizes a failed /api/me call (after successful auth) as BACKEND_ERROR", async () => {
    mockWaitForTelegramLaunch.mockResolvedValue({ kind: "webapp", initData: "auth_date=1&hash=abc" });
    mockFetchSequence({
      "/api/auth/telegram": () => ({ ok: true, json: async () => ({ ok: true }) }),
      "/api/me": () => ({ ok: false, json: async () => ({}) }),
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(screen.getByTestId("category")).toHaveTextContent("BACKEND_ERROR");
  });
});

describe("AuthProvider — retry()", () => {
  it("re-runs the whole bootstrap and can recover from a transient failure", async () => {
    mockWaitForTelegramLaunch
      .mockResolvedValueOnce({ kind: "no_webapp" })
      .mockResolvedValueOnce({ kind: "webapp", initData: "auth_date=1&hash=abc" });
    let call = 0;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/auth/telegram")) {
        call += 1;
        if (call === 1) {
          return Promise.resolve({ ok: false, json: async () => ({ error: { code: "MISSING_INIT_DATA" } }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      if (url.includes("/api/me")) {
        return Promise.resolve({ ok: true, json: async () => ({ id: "u1", timezone: "UTC" }) });
      }
      return Promise.reject(new Error("unexpected"));
    }) as unknown as typeof fetch;

    function RetryConsumer() {
      const { status, retry } = useAuth();
      return (
        <div>
          <div data-testid="status">{status}</div>
          <button onClick={retry}>retry</button>
        </div>
      );
    }

    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <AuthProvider>
        <RetryConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    await userEvent.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
  });
});

describe("AuthProvider — completeLoginWidgetAuth", () => {
  it("re-fetches /api/me directly without re-running the Mini App bootstrap", async () => {
    mockWaitForTelegramLaunch.mockResolvedValue({ kind: "no_webapp" });
    let meCallCount = 0;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/auth/telegram")) {
        return Promise.resolve({ ok: false, json: async () => ({ error: { code: "MISSING_INIT_DATA" } }) });
      }
      if (url.includes("/api/me")) {
        meCallCount += 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: "u1", firstName: "Web", timezone: "UTC" }),
        });
      }
      return Promise.reject(new Error("unexpected"));
    }) as unknown as typeof fetch;

    function WidgetConsumer() {
      const { status, user, completeLoginWidgetAuth } = useAuth();
      return (
        <div>
          <div data-testid="status">{status}</div>
          <div data-testid="user">{user?.firstName ?? ""}</div>
          <button onClick={completeLoginWidgetAuth}>complete</button>
        </div>
      );
    }

    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <AuthProvider>
        <WidgetConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    // The Mini App bootstrap ran once by now (one waitForTelegramLaunch call).
    expect(mockWaitForTelegramLaunch).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "complete" }));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("Web");
    expect(meCallCount).toBe(1);
    // Completing via the widget must not re-trigger waitForTelegramLaunch.
    expect(mockWaitForTelegramLaunch).toHaveBeenCalledTimes(1);
  });
});
