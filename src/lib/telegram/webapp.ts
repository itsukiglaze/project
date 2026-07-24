"use client";

import type { TelegramWebApp } from "@/types/telegram";

/**
 * Central wrapper around `window.Telegram.WebApp`.
 *
 * Every function here is safe to call even when the app is not running
 * inside Telegram (plain browser, unit tests, SSR) — it degrades to a
 * harmless no-op or a sensible default instead of throwing, so the rest of
 * the app never needs its own `typeof window` / `window.Telegram` checks.
 */

export function isInsideTelegram(): boolean {
  return typeof window !== "undefined" && Boolean(window.Telegram?.WebApp);
}

function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/** Call once on app mount. No-op outside Telegram. */
export function initTelegramWebApp(): void {
  const webApp = getWebApp();
  if (!webApp) return;
  webApp.ready();
  webApp.expand();
}

/**
 * Raw `initData` string to send to the server for verification.
 * Returns an empty string outside Telegram (the server then falls back to
 * dev-auth if explicitly enabled, or rejects the request in production).
 */
export function getRawInitData(): string {
  return getWebApp()?.initData ?? "";
}

export function getColorScheme(): "light" | "dark" {
  const webApp = getWebApp();
  if (webApp) return webApp.colorScheme;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function getThemeParams(): Record<string, string> {
  const webApp = getWebApp();
  if (!webApp) return {};
  return webApp.themeParams as Record<string, string>;
}

export function triggerHapticImpact(style: "light" | "medium" | "heavy" = "light"): void {
  try {
    getWebApp()?.HapticFeedback?.impactOccurred?.(style);
  } catch {
    // Haptics are a nice-to-have. Some Telegram clients/versions may
    // expose a partial WebApp object where HapticFeedback throws (e.g. an
    // unsupported style) — that must never take down whatever just
    // succeeded (e.g. a completed calculation).
  }
}

export function triggerHapticNotification(type: "error" | "success" | "warning"): void {
  try {
    getWebApp()?.HapticFeedback?.notificationOccurred?.(type);
  } catch {
    // See triggerHapticImpact — deliberately swallowed.
  }
}

export function showBackButton(onClick: () => void): void {
  const webApp = getWebApp();
  if (!webApp) return;
  webApp.BackButton.onClick(onClick);
  webApp.BackButton.show();
}

export function hideBackButton(onClick?: () => void): void {
  const webApp = getWebApp();
  if (!webApp) return;
  if (onClick) webApp.BackButton.offClick(onClick);
  webApp.BackButton.hide();
}

/** IANA timezone as seen by the client's own runtime — Telegram does not provide this. */
export function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
