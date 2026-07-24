"use client";

import { useEffect } from "react";
import { getColorScheme, isInsideTelegram } from "@/lib/telegram/webapp";

/**
 * Applies Telegram's `colorScheme` (light/dark) as a `.dark` class on
 * `<html>`, falling back to the OS-level `prefers-color-scheme` when not
 * running inside Telegram. A future per-user "system / light / dark"
 * setting (see Settings tab) can override this by writing the same class.
 */
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

  return <>{children}</>;
}
