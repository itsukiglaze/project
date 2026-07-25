// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { TelegramWebApp } from "@/types/telegram";
import { isWebAppVersionAtLeast, snapshotTelegramEnvironment, supportsWebAppFeature } from "./diagnostics";

afterEach(() => {
  delete window.Telegram;
});

function installMockWebApp(partial: Partial<TelegramWebApp>) {
  window.Telegram = { WebApp: partial as TelegramWebApp };
}

describe("snapshotTelegramEnvironment", () => {
  it("reports everything absent outside Telegram", () => {
    const snapshot = snapshotTelegramEnvironment();
    expect(snapshot).toEqual({
      webAppPresent: false,
      initDataPresent: false,
      version: null,
      platform: null,
      initDataUnsafePresent: false,
    });
  });

  it("reports WebApp present with non-empty initData (the ordinary, successful case)", () => {
    installMockWebApp({
      initData: "auth_date=1&hash=abc",
      initDataUnsafe: { auth_date: "1" },
      version: "7.10",
      platform: "ios",
    });
    const snapshot = snapshotTelegramEnvironment();
    expect(snapshot.webAppPresent).toBe(true);
    expect(snapshot.initDataPresent).toBe(true);
    expect(snapshot.version).toBe("7.10");
    expect(snapshot.platform).toBe("ios");
    expect(snapshot.initDataUnsafePresent).toBe(true);
  });

  it("reports WebApp present but initData empty — the AyuGram symptom", () => {
    installMockWebApp({
      initData: "",
      initDataUnsafe: {},
      version: "6.9",
      platform: "android",
    });
    const snapshot = snapshotTelegramEnvironment();
    expect(snapshot.webAppPresent).toBe(true);
    expect(snapshot.initDataPresent).toBe(false);
    expect(snapshot.initDataUnsafePresent).toBe(false);
  });

  it("never exposes initDataUnsafe's actual contents, only a presence boolean", () => {
    installMockWebApp({
      initData: "auth_date=1&hash=abc",
      initDataUnsafe: { user: { id: 123, first_name: "Secret" } },
    });
    const snapshot = snapshotTelegramEnvironment();
    // The type itself has no field that could carry the contents through —
    // this assertion documents that guarantee.
    expect(Object.keys(snapshot)).not.toContain("initDataUnsafe");
    expect(snapshot.initDataUnsafePresent).toBe(true);
  });

  it("degrades gracefully when version/platform are missing from a partial WebApp object", () => {
    installMockWebApp({ initData: "" });
    const snapshot = snapshotTelegramEnvironment();
    expect(snapshot.version).toBeNull();
    expect(snapshot.platform).toBeNull();
  });
});

describe("isWebAppVersionAtLeast", () => {
  it("returns false outside Telegram", () => {
    expect(isWebAppVersionAtLeast("8.0")).toBe(false);
  });

  it("returns false when isVersionAtLeast is absent (an old/partial WebApp implementation)", () => {
    installMockWebApp({ initData: "", version: "6.0" });
    expect(isWebAppVersionAtLeast("8.0")).toBe(false);
  });

  it("delegates to the real isVersionAtLeast when present", () => {
    installMockWebApp({
      initData: "",
      isVersionAtLeast: (v: string) => v === "8.0",
    });
    expect(isWebAppVersionAtLeast("8.0")).toBe(true);
    expect(isWebAppVersionAtLeast("9.0")).toBe(false);
  });

  it("does not throw when isVersionAtLeast itself throws (a broken/unofficial client)", () => {
    installMockWebApp({
      initData: "",
      isVersionAtLeast: () => {
        throw new Error("simulated broken client");
      },
    });
    expect(() => isWebAppVersionAtLeast("8.0")).not.toThrow();
    expect(isWebAppVersionAtLeast("8.0")).toBe(false);
  });
});

describe("supportsWebAppFeature", () => {
  it("returns false outside Telegram", () => {
    expect(supportsWebAppFeature("safeAreaInset")).toBe(false);
  });

  it("returns false for a feature absent on this client", () => {
    installMockWebApp({ initData: "" });
    expect(supportsWebAppFeature("safeAreaInset")).toBe(false);
  });

  it("returns true for a feature present on this client", () => {
    installMockWebApp({ initData: "", safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 } });
    expect(supportsWebAppFeature("safeAreaInset")).toBe(true);
  });
});
