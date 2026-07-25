// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TelegramLoginWidget } from "./telegram-login-widget";

const originalUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
const originalFetch = global.fetch;

afterEach(() => {
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = originalUsername;
  global.fetch = originalFetch;
  delete window.onTelegramAuth;
  vi.restoreAllMocks();
});

describe("TelegramLoginWidget", () => {
  it("renders nothing when NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is not configured", () => {
    delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    const { container } = render(
      <TelegramLoginWidget onAuthenticated={vi.fn()} onError={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("fetches a nonce, injects the Telegram widget script, and registers window.onTelegramAuth", async () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "proxy_pull_planner_bot";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: "test-nonce" }),
    }) as unknown as typeof fetch;

    render(<TelegramLoginWidget onAuthenticated={vi.fn()} onError={vi.fn()} />);

    await waitFor(() => expect(typeof window.onTelegramAuth).toBe("function"));

    const container = screen.getByTestId("telegram-login-widget-container");
    const script = container.querySelector("script");
    expect(script).not.toBeNull();
    expect(script?.getAttribute("data-telegram-login")).toBe("proxy_pull_planner_bot");
    expect(script?.getAttribute("data-onauth")).toBe("onTelegramAuth(user)");
  });

  it("posts the normalized Telegram payload + nonce to the verify endpoint when the widget callback fires, and calls onAuthenticated on success", async () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "proxy_pull_planner_bot";
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/nonce")) {
        return Promise.resolve({ ok: true, json: async () => ({ nonce: "test-nonce" }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const onAuthenticated = vi.fn();
    render(<TelegramLoginWidget onAuthenticated={onAuthenticated} onError={vi.fn()} />);
    await waitFor(() => expect(typeof window.onTelegramAuth).toBe("function"));

    window.onTelegramAuth?.({
      id: 111222333,
      first_name: "Anya",
      username: "anya_zzz",
      auth_date: 1700000000,
      hash: "deadbeef",
    });

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));

    const verifyCall = fetchMock.mock.calls.find(([url]) => url.includes("/verify"));
    expect(verifyCall).toBeDefined();
    const body = JSON.parse(verifyCall![1].body as string);
    expect(body).toMatchObject({
      id: "111222333",
      first_name: "Anya",
      username: "anya_zzz",
      auth_date: "1700000000",
      hash: "deadbeef",
      nonce: "test-nonce",
    });
  });

  it("calls onError with the server's error code when verification is rejected", async () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "proxy_pull_planner_bot";
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/nonce")) {
        return Promise.resolve({ ok: true, json: async () => ({ nonce: "test-nonce" }) });
      }
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: { code: "SIGNATURE_MISMATCH" } }),
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const onError = vi.fn();
    render(<TelegramLoginWidget onAuthenticated={vi.fn()} onError={onError} />);
    await waitFor(() => expect(typeof window.onTelegramAuth).toBe("function"));

    window.onTelegramAuth?.({
      id: 111222333,
      auth_date: 1700000000,
      hash: "deadbeef",
    });

    await waitFor(() => expect(onError).toHaveBeenCalledWith("SIGNATURE_MISMATCH"));
  });

  it("calls onError when the nonce endpoint itself fails (e.g. SESSION_SECRET not configured -> 503)", async () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "proxy_pull_planner_bot";
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const onError = vi.fn();
    render(<TelegramLoginWidget onAuthenticated={vi.fn()} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledWith("NONCE_UNAVAILABLE"));
  });

  it("cleans up window.onTelegramAuth on unmount", async () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "proxy_pull_planner_bot";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: "test-nonce" }),
    }) as unknown as typeof fetch;

    const { unmount } = render(<TelegramLoginWidget onAuthenticated={vi.fn()} onError={vi.fn()} />);
    await waitFor(() => expect(typeof window.onTelegramAuth).toBe("function"));

    unmount();
    expect(window.onTelegramAuth).toBeUndefined();
  });
});

describe("beforeEach reset guard", () => {
  beforeEach(() => {
    delete window.onTelegramAuth;
  });
  it("starts with no leaked global callback from a previous test", () => {
    expect(window.onTelegramAuth).toBeUndefined();
  });
});
