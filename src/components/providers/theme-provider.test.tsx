// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { TelegramWebApp } from "@/types/telegram";
import { ThemeProvider } from "./theme-provider";

beforeEach(() => {
  // jsdom does not implement matchMedia — ThemeProvider's outside-Telegram
  // branch (prefers-color-scheme) needs it. Not exercised by these
  // Telegram-focused tests otherwise.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  delete window.Telegram;
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("style");
});

function installMockWebApp(partial: Partial<TelegramWebApp>) {
  window.Telegram = { WebApp: partial as TelegramWebApp };
}

describe("ThemeProvider — Telegram theme/viewport/safe-area CSS variables", () => {
  it("does not set any --tg- CSS variables outside Telegram", () => {
    render(<ThemeProvider>content</ThemeProvider>);
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--tg-viewport-stable-height")).toBe("");
    expect(style.getPropertyValue("--tg-theme-bg-color")).toBe("");
  });

  it("exposes theme_params as --tg-theme-* CSS custom properties", () => {
    installMockWebApp({
      colorScheme: "light",
      themeParams: { bg_color: "#ffffff", button_color: "#2ea6ff" },
    });
    render(<ThemeProvider>content</ThemeProvider>);
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--tg-theme-bg-color")).toBe("#ffffff");
    expect(style.getPropertyValue("--tg-theme-button-color")).toBe("#2ea6ff");
  });

  it("exposes viewportStableHeight as --tg-viewport-stable-height in px", () => {
    installMockWebApp({ colorScheme: "light", viewportStableHeight: 640 });
    render(<ThemeProvider>content</ThemeProvider>);
    expect(document.documentElement.style.getPropertyValue("--tg-viewport-stable-height")).toBe("640px");
  });

  it("exposes safeAreaInset/contentSafeAreaInset as --tg-*-safe-area-inset-* in px", () => {
    installMockWebApp({
      colorScheme: "light",
      safeAreaInset: { top: 44, bottom: 34, left: 0, right: 0 },
      contentSafeAreaInset: { top: 88, bottom: 0, left: 0, right: 0 },
    });
    render(<ThemeProvider>content</ThemeProvider>);
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--tg-safe-area-inset-top")).toBe("44px");
    expect(style.getPropertyValue("--tg-safe-area-inset-bottom")).toBe("34px");
    expect(style.getPropertyValue("--tg-content-safe-area-inset-top")).toBe("88px");
  });

  it("does not throw when themeParams/viewportStableHeight/safeAreaInset are all absent (an old WebApp version)", () => {
    installMockWebApp({ colorScheme: "light" });
    expect(() => render(<ThemeProvider>content</ThemeProvider>)).not.toThrow();
  });

  it("re-applies viewport/safe-area values when Telegram fires viewportChanged", () => {
    const registered: { cb: (() => void) | null } = { cb: null };
    installMockWebApp({
      colorScheme: "light",
      viewportStableHeight: 600,
      onEvent: (eventType, cb) => {
        if (eventType === "viewportChanged") registered.cb = cb;
      },
      offEvent: () => undefined,
    });
    render(<ThemeProvider>content</ThemeProvider>);
    expect(document.documentElement.style.getPropertyValue("--tg-viewport-stable-height")).toBe("600px");

    // Simulate Telegram reporting a new height (e.g. keyboard dismissed).
    const webApp = window.Telegram?.WebApp;
    if (webApp) webApp.viewportStableHeight = 700;
    registered.cb?.();

    expect(document.documentElement.style.getPropertyValue("--tg-viewport-stable-height")).toBe("700px");
  });

  it("applies the .dark class from colorScheme as before (no regression)", () => {
    installMockWebApp({ colorScheme: "dark" });
    render(<ThemeProvider>content</ThemeProvider>);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
