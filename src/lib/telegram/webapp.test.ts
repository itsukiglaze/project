// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { TelegramWebApp } from "@/types/telegram";
import {
  getClientTimezone,
  getColorScheme,
  getSafeAreaInsets,
  getViewportStableHeight,
  hideBackButton,
  initTelegramWebApp,
  isInsideTelegram,
  onViewportChanged,
  showBackButton,
  triggerHapticImpact,
  triggerHapticNotification,
  waitForTelegramLaunch,
} from "./webapp";

afterEach(() => {
  delete window.Telegram;
});

function installMockWebApp(partial: Partial<TelegramWebApp>) {
  window.Telegram = { WebApp: partial as TelegramWebApp };
}

describe("outside Telegram", () => {
  it("isInsideTelegram is false", () => {
    expect(isInsideTelegram()).toBe(false);
  });

  it("18. triggerHapticImpact / triggerHapticNotification are safe no-ops", () => {
    expect(() => triggerHapticImpact("light")).not.toThrow();
    expect(() => triggerHapticNotification("success")).not.toThrow();
  });

  it("getClientTimezone returns a non-empty IANA-looking string", () => {
    expect(getClientTimezone().length).toBeGreaterThan(0);
  });
});

describe("18. inside Telegram, with a WebApp API that itself throws", () => {
  it("does not let a throwing HapticFeedback.impactOccurred break the caller", () => {
    installMockWebApp({
      colorScheme: "light",
      HapticFeedback: {
        impactOccurred: () => {
          throw new Error("simulated unsupported style in this Telegram client");
        },
        notificationOccurred: () => {
          throw new Error("simulated failure");
        },
        selectionChanged: () => undefined,
      },
    });

    expect(() => triggerHapticImpact("light")).not.toThrow();
    expect(() => triggerHapticNotification("success")).not.toThrow();
  });

  it("is a safe no-op when HapticFeedback is entirely missing from the WebApp object", () => {
    installMockWebApp({ colorScheme: "light" });

    expect(() => triggerHapticImpact("light")).not.toThrow();
    expect(() => triggerHapticNotification("success")).not.toThrow();
  });

  it("getColorScheme reads the real WebApp value when present", () => {
    installMockWebApp({ colorScheme: "dark" });
    expect(getColorScheme()).toBe("dark");
  });
});

describe("initTelegramWebApp — feature detection / old or partial WebApp versions", () => {
  it("is a no-op outside Telegram", () => {
    expect(() => initTelegramWebApp()).not.toThrow();
  });

  it("calls ready() and expand() when both are present", () => {
    const ready = () => undefined;
    const expand = () => undefined;
    let readyCalled = false;
    let expandCalled = false;
    installMockWebApp({
      ready: () => {
        readyCalled = true;
        ready();
      },
      expand: () => {
        expandCalled = true;
        expand();
      },
    });
    initTelegramWebApp();
    expect(readyCalled).toBe(true);
    expect(expandCalled).toBe(true);
  });

  it("does not throw when ready/expand are entirely absent (an old Bot API version)", () => {
    installMockWebApp({ colorScheme: "light" });
    expect(() => initTelegramWebApp()).not.toThrow();
  });

  it("does not throw when ready/expand throw internally (an unofficial/broken client)", () => {
    installMockWebApp({
      ready: () => {
        throw new Error("simulated unsupported call");
      },
      expand: () => {
        throw new Error("simulated unsupported call");
      },
    });
    expect(() => initTelegramWebApp()).not.toThrow();
  });
});

describe("showBackButton / hideBackButton — feature detection", () => {
  it("is a no-op outside Telegram", () => {
    expect(() => showBackButton(() => undefined)).not.toThrow();
    expect(() => hideBackButton()).not.toThrow();
  });

  it("does not throw when BackButton is entirely absent from a partial WebApp object", () => {
    installMockWebApp({ colorScheme: "light" });
    expect(() => showBackButton(() => undefined)).not.toThrow();
    expect(() => hideBackButton()).not.toThrow();
  });

  it("calls through to the real BackButton when present", () => {
    let shown = false;
    installMockWebApp({
      BackButton: {
        isVisible: false,
        show: () => {
          shown = true;
        },
        hide: () => undefined,
        onClick: () => undefined,
        offClick: () => undefined,
      },
    });
    showBackButton(() => undefined);
    expect(shown).toBe(true);
  });
});

describe("waitForTelegramLaunch — bounded polling", () => {
  it("resolves immediately with kind 'webapp' when initData is already non-empty", async () => {
    installMockWebApp({ initData: "auth_date=1&hash=abc" });
    const start = Date.now();
    const result = await waitForTelegramLaunch({ timeoutMs: 500, intervalMs: 10 });
    expect(result).toEqual({ kind: "webapp", initData: "auth_date=1&hash=abc" });
    expect(Date.now() - start).toBeLessThan(100);
  });

  it("resolves to 'no_webapp' after the bounded timeout when WebApp never appears", async () => {
    const result = await waitForTelegramLaunch({ timeoutMs: 60, intervalMs: 10 });
    expect(result).toEqual({ kind: "no_webapp" });
  });

  it("resolves to 'webapp_empty_init_data' after the bounded timeout when WebApp is present but initData never becomes non-empty", async () => {
    installMockWebApp({ initData: "" });
    const result = await waitForTelegramLaunch({ timeoutMs: 60, intervalMs: 10 });
    expect(result).toEqual({ kind: "webapp_empty_init_data" });
  });

  it("resolves successfully once initData becomes non-empty mid-wait (delayed Telegram object initialization)", async () => {
    installMockWebApp({ initData: "" });
    setTimeout(() => {
      const webApp = window.Telegram?.WebApp;
      if (webApp) webApp.initData = "auth_date=1&hash=abc";
    }, 30);

    const result = await waitForTelegramLaunch({ timeoutMs: 500, intervalMs: 10 });
    expect(result).toEqual({ kind: "webapp", initData: "auth_date=1&hash=abc" });
  });

  it("resolves successfully once WebApp itself appears mid-wait (script loaded late)", async () => {
    setTimeout(() => {
      installMockWebApp({ initData: "auth_date=1&hash=abc" });
    }, 30);

    const result = await waitForTelegramLaunch({ timeoutMs: 500, intervalMs: 10 });
    expect(result).toEqual({ kind: "webapp", initData: "auth_date=1&hash=abc" });
  });

  it("never waits longer than the configured bound (no infinite retry loop)", async () => {
    const start = Date.now();
    await waitForTelegramLaunch({ timeoutMs: 80, intervalMs: 10 });
    expect(Date.now() - start).toBeLessThan(300);
  });
});

describe("viewport stable height / viewportChanged / safe-area insets", () => {
  it("getViewportStableHeight returns null outside Telegram", () => {
    expect(getViewportStableHeight()).toBeNull();
  });

  it("getViewportStableHeight returns the real value when present", () => {
    installMockWebApp({ viewportStableHeight: 640 });
    expect(getViewportStableHeight()).toBe(640);
  });

  it("onViewportChanged is a safe no-op outside Telegram", () => {
    const unsubscribe = onViewportChanged(() => undefined);
    expect(() => unsubscribe()).not.toThrow();
  });

  it("onViewportChanged is a safe no-op when onEvent is absent (an old WebApp version)", () => {
    installMockWebApp({ colorScheme: "light" });
    const unsubscribe = onViewportChanged(() => undefined);
    expect(() => unsubscribe()).not.toThrow();
  });

  it("onViewportChanged subscribes via onEvent and unsubscribes via offEvent when both are present", () => {
    let subscribedCb: (() => void) | null = null;
    let unsubscribedCb: (() => void) | null = null;
    installMockWebApp({
      onEvent: (eventType, cb) => {
        if (eventType === "viewportChanged") subscribedCb = cb;
      },
      offEvent: (eventType, cb) => {
        if (eventType === "viewportChanged") unsubscribedCb = cb;
      },
    });
    const cb = () => undefined;
    const unsubscribe = onViewportChanged(cb);
    expect(subscribedCb).toBe(cb);
    unsubscribe();
    expect(unsubscribedCb).toBe(cb);
  });

  it("getSafeAreaInsets returns nulls outside Telegram / on an old client that lacks them", () => {
    expect(getSafeAreaInsets()).toEqual({ safeArea: null, contentSafeArea: null });
    installMockWebApp({ colorScheme: "light" });
    expect(getSafeAreaInsets()).toEqual({ safeArea: null, contentSafeArea: null });
  });

  it("getSafeAreaInsets returns the real values when present (Bot API 8.0+)", () => {
    installMockWebApp({
      safeAreaInset: { top: 44, bottom: 0, left: 0, right: 0 },
      contentSafeAreaInset: { top: 88, bottom: 0, left: 0, right: 0 },
    });
    expect(getSafeAreaInsets()).toEqual({
      safeArea: { top: 44, bottom: 0, left: 0, right: 0 },
      contentSafeArea: { top: 88, bottom: 0, left: 0, right: 0 },
    });
  });
});
