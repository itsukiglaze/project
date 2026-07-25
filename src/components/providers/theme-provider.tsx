"use client";

import { useEffect } from "react";
import {
  getColorScheme,
  getSafeAreaInsets,
  getThemeParams,
  getViewportStableHeight,
  isInsideTelegram,
  onViewportChanged,
} from "@/lib/telegram/webapp";

/**
 * Applies Telegram's `colorScheme` (light/dark) as a `.dark` class on
 * `<html>`, falling back to the OS-level `prefers-color-scheme` when not
 * running inside Telegram. A future per-user "system / light / dark"
 * setting (see Settings tab) can override this by writing the same class.
 *
 * Also exposes Telegram's own theme params, viewport-stable-height, and
 * safe-area insets as `--tg-*` CSS custom properties on `:root` — a
 * progressive enhancement layered ON TOP of this app's own branded design
 * tokens (globals.css), not a replacement for them: the app keeps its own
 * palette by default, but any component that wants to defer to the host
 * client's actual theme/geometry (e.g. viewport-stable-height for the
 * bottom nav instead of assuming 100vh) has real values to read.
 */

function snakeToKebab(key: string): string {
  return key.replace(/_/g, "-");
}

function applyThemeParams(): void {
  const root = document.documentElement.style;
  const params = getThemeParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) {
      root.setProperty(`--tg-theme-${snakeToKebab(key)}`, value);
    }
  }
}

function applyViewportAndSafeArea(): void {
  const root = document.documentElement.style;

  const stableHeight = getViewportStableHeight();
  if (stableHeight != null) {
    root.setProperty("--tg-viewport-stable-height", `${stableHeight}px`);
  }

  const { safeArea, contentSafeArea } = getSafeAreaInsets();
  if (safeArea) {
    root.setProperty("--tg-safe-area-inset-top", `${safeArea.top}px`);
    root.setProperty("--tg-safe-area-inset-bottom", `${safeArea.bottom}px`);
    root.setProperty("--tg-safe-area-inset-left", `${safeArea.left}px`);
    root.setProperty("--tg-safe-area-inset-right", `${safeArea.right}px`);
  }
  if (contentSafeArea) {
    root.setProperty("--tg-content-safe-area-inset-top", `${contentSafeArea.top}px`);
    root.setProperty("--tg-content-safe-area-inset-bottom", `${contentSafeArea.bottom}px`);
    root.setProperty("--tg-content-safe-area-inset-left", `${contentSafeArea.left}px`);
    root.setProperty("--tg-content-safe-area-inset-right", `${contentSafeArea.right}px`);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const applyScheme = () => {
      const scheme = getColorScheme();
      document.documentElement.classList.toggle("dark", scheme === "dark");
    };

    applyScheme();

    if (!isInsideTelegram() && typeof window !== "undefined") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", applyScheme);
      return () => media.removeEventListener("change", applyScheme);
    }
  }, []);

  useEffect(() => {
    if (!isInsideTelegram()) return;
    applyThemeParams();
    applyViewportAndSafeArea();
    return onViewportChanged(applyViewportAndSafeArea);
  }, []);

  return <>{children}</>;
}
