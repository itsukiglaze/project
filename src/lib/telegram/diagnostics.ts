"use client";

import type { TelegramWebApp } from "@/types/telegram";

/**
 * A point-in-time read of what the current Telegram client actually
 * exposes — used for diagnostics/UI branching only, NEVER for
 * authentication. `initDataUnsafe` is captured here purely as a presence
 * boolean (never its contents): the field is client-suppliable and
 * unsigned, so it must never influence any auth or authorization decision.
 *
 * Deliberately does NOT fingerprint specific unofficial clients (e.g.
 * "AyuGram") via `navigator.userAgent` — Telegram's own reported
 * `platform`/`version` are already the official, structured way to tell
 * clients apart, and matching third-party clients by UA string is both
 * fragile (breaks silently the moment a client changes its UA) and not
 * needed for anything this app actually does differently per-client.
 */
export interface TelegramEnvironmentSnapshot {
  /** `window.Telegram.WebApp` exists at all. */
  webAppPresent: boolean;
  /** `WebApp.initData` is a non-empty string. */
  initDataPresent: boolean;
  /** `WebApp.version`, or null if `WebApp` itself is absent. */
  version: string | null;
  /** `WebApp.platform`, or null if `WebApp` itself is absent. */
  platform: string | null;
  /** Whether `WebApp.initDataUnsafe` has any own keys — presence only, never its contents. */
  initDataUnsafePresent: boolean;
}

function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function snapshotTelegramEnvironment(): TelegramEnvironmentSnapshot {
  const webApp = getWebApp();
  if (!webApp) {
    return {
      webAppPresent: false,
      initDataPresent: false,
      version: null,
      platform: null,
      initDataUnsafePresent: false,
    };
  }
  return {
    webAppPresent: true,
    initDataPresent: typeof webApp.initData === "string" && webApp.initData.length > 0,
    version: typeof webApp.version === "string" ? webApp.version : null,
    platform: typeof webApp.platform === "string" ? webApp.platform : null,
    initDataUnsafePresent:
      webApp.initDataUnsafe != null && Object.keys(webApp.initDataUnsafe).length > 0,
  };
}

/**
 * Official Telegram feature-detection helper, itself optionally present
 * (absent on old/partial WebApp implementations — see types/telegram.d.ts).
 * Always call through this rather than `webApp.isVersionAtLeast(...)`
 * directly, so a missing method degrades to "unknown, assume unsupported"
 * instead of throwing.
 */
export function isWebAppVersionAtLeast(version: string): boolean {
  const webApp = getWebApp();
  if (!webApp || typeof webApp.isVersionAtLeast !== "function") return false;
  try {
    return webApp.isVersionAtLeast(version);
  } catch {
    return false;
  }
}

/** Feature-detects a specific method/property path on the live WebApp object. */
export function supportsWebAppFeature(feature: keyof TelegramWebApp): boolean {
  const webApp = getWebApp();
  if (!webApp) return false;
  return webApp[feature] != null;
}
