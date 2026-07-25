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

/**
 * Call once on app mount. No-op outside Telegram. Every method call is
 * feature-detected first — some clients expose a partial `WebApp` object
 * (an old Bot API version, or a third-party client with an incomplete
 * implementation), and a missing `ready`/`expand` must never throw and
 * take the rest of the app down with it.
 */
export function initTelegramWebApp(): void {
  const webApp = getWebApp();
  if (!webApp) return;
  try {
    if (typeof webApp.ready === "function") webApp.ready();
  } catch {
    // Deliberately swallowed — see triggerHapticImpact for the same pattern.
  }
  try {
    if (typeof webApp.expand === "function") webApp.expand();
  } catch {
    // Deliberately swallowed.
  }
}

/**
 * Raw `initData` string to send to the server for verification.
 * Returns an empty string outside Telegram (the server then falls back to
 * dev-auth if explicitly enabled, or rejects the request in production).
 */
export function getRawInitData(): string {
  return getWebApp()?.initData ?? "";
}

export type TelegramLaunchState =
  /** `WebApp` present with a non-empty `initData` — the normal path. */
  | { kind: "webapp"; initData: string }
  /** `WebApp` present, but `initData` never became non-empty within the wait window (e.g. some AyuGram launches). */
  | { kind: "webapp_empty_init_data" }
  /** `WebApp` never appeared at all — an ordinary browser, or the script failed to load. */
  | { kind: "no_webapp" };

export interface WaitForTelegramLaunchOptions {
  /** Total bounded wait, in ms. Defaults to 1500 — this is a ceiling, not a fixed delay: resolves immediately once `WebApp.initData` is non-empty. */
  timeoutMs?: number;
  /** Poll interval, in ms. */
  intervalMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * `telegram-web-app.js` is loaded async, and some clients (this is the
 * AyuGram symptom this exists for) populate `WebApp.initData` a beat after
 * `WebApp` itself first appears — reading it exactly once on the first
 * React render can observe it still empty even though it would have been
 * populated a few hundred ms later. Polls for `WebApp.initData` to become
 * non-empty, up to a bounded ceiling — never loops forever: it always
 * resolves, either early (success) or at the deadline (one of the two
 * failure states, distinguished by whether `WebApp` itself ever showed up).
 */
export async function waitForTelegramLaunch(
  options: WaitForTelegramLaunchOptions = {},
): Promise<TelegramLaunchState> {
  const timeoutMs = options.timeoutMs ?? 1500;
  const intervalMs = options.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const webApp = getWebApp();
    if (webApp && typeof webApp.initData === "string" && webApp.initData.length > 0) {
      return { kind: "webapp", initData: webApp.initData };
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      return webApp ? { kind: "webapp_empty_init_data" } : { kind: "no_webapp" };
    }
    await sleep(Math.min(intervalMs, remaining));
  }
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
  if (!webApp?.themeParams) return {};
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
  try {
    const webApp = getWebApp();
    if (!webApp?.BackButton) return;
    webApp.BackButton.onClick(onClick);
    webApp.BackButton.show();
  } catch {
    // See triggerHapticImpact — a partial/unofficial client's BackButton
    // must never take down navigation.
  }
}

export function hideBackButton(onClick?: () => void): void {
  try {
    const webApp = getWebApp();
    if (!webApp?.BackButton) return;
    if (onClick) webApp.BackButton.offClick(onClick);
    webApp.BackButton.hide();
  } catch {
    // Deliberately swallowed.
  }
}

/** IANA timezone as seen by the client's own runtime — Telegram does not provide this. */
export function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * `WebApp.viewportStableHeight`, in px — the height once any transient
 * keyboard/UI animation has settled, which Telegram recommends over
 * `viewportHeight` (which jitters during those animations) and over CSS
 * `100vh`/`100dvh` (which don't know about Telegram's own chrome at all).
 * Returns null outside Telegram or on a client too old to report it.
 */
export function getViewportStableHeight(): number | null {
  const webApp = getWebApp();
  if (!webApp || typeof webApp.viewportStableHeight !== "number") return null;
  return webApp.viewportStableHeight;
}

/**
 * Subscribes to Telegram's `viewportChanged` event, feature-detected —
 * older clients don't have `onEvent`/`offEvent` at all. Returns an
 * unsubscribe function; a no-op outside Telegram or when unsupported.
 */
export function onViewportChanged(cb: () => void): () => void {
  const webApp = getWebApp();
  if (!webApp || typeof webApp.onEvent !== "function") return () => undefined;
  try {
    webApp.onEvent("viewportChanged", cb);
  } catch {
    return () => undefined;
  }
  return () => {
    try {
      webApp.offEvent?.("viewportChanged", cb);
    } catch {
      // Deliberately swallowed.
    }
  };
}

/**
 * Telegram's own reported safe-area insets (Bot API 8.0+, fullscreen
 * mode) — preferred over CSS `env(safe-area-inset-*)` when present, since
 * they account for Telegram's own chrome, not just the OS/browser's.
 * `content` also subtracts Telegram's in-app header. Both are optional;
 * absent (null) on older clients or outside Telegram.
 */
export function getSafeAreaInsets(): {
  safeArea: TelegramWebApp["safeAreaInset"] | null;
  contentSafeArea: TelegramWebApp["contentSafeAreaInset"] | null;
} {
  const webApp = getWebApp();
  return {
    safeArea: webApp?.safeAreaInset ?? null,
    contentSafeArea: webApp?.contentSafeAreaInset ?? null,
  };
}
