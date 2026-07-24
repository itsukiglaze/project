// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { TelegramWebApp } from "@/types/telegram";
import {
  getClientTimezone,
  getColorScheme,
  isInsideTelegram,
  triggerHapticImpact,
  triggerHapticNotification,
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
