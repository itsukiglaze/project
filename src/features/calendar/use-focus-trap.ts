"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab focus inside the returned container ref (Tab from the last
 * focusable element wraps to the first, Shift+Tab from the first wraps to
 * the last), moves focus into the container on mount, restores focus to
 * whatever was focused immediately before mount when it unmounts or
 * `active` turns false, and calls `onClose` on Escape.
 *
 * Pass `active: false` while a nested dialog rendered inside this one owns
 * focus instead (e.g. a ConfirmDialog opened from within DayDetailSheet) —
 * this suspends the outer trap's Tab wrapping and Escape handling so the
 * two don't fight over the same keydown.
 */
export function useFocusTrap<T extends HTMLElement>(
  onClose: () => void,
  options?: { initialFocusRef?: RefObject<HTMLElement | null>; active?: boolean },
): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const active = options?.active ?? true;
  const initialFocusRef = options?.initialFocusRef;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    function getFocusable(): HTMLElement[] {
      return Array.from(container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    }

    const initial = initialFocusRef?.current ?? getFocusable()[0] ?? container;
    initial.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = getFocusable();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === first || !container!.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeElement === last || !container!.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [active, onClose, initialFocusRef]);

  return containerRef;
}
