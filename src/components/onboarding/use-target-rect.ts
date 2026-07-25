"use client";

import { useEffect, useRef, useState } from "react";
import { onboardingTargetSelector, type OnboardingTargetId } from "@/lib/onboarding/targets";

export type TargetRectState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "found"; rect: DOMRect; element: HTMLElement }
  | { status: "missing" };

const SEARCH_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 120;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Locates a real UI element by its semantic `data-onboarding-target`
 * attribute (never a CSS class name, never text matching, never a
 * hardcoded coordinate) and keeps its bounding rect current as the
 * viewport, scroll position, safe area, or orientation changes. Retries
 * for a bounded period if the target hasn't rendered yet (e.g. the route
 * just changed and the destination screen is still mounting), then fails
 * gracefully to "missing" rather than hanging forever.
 */
export function useOnboardingTargetRect(
  targetId: OnboardingTargetId | null,
  /** Bump to force a fresh search after a "missing" result (e.g. a user-pressed "Повторить"). */
  retryToken = 0,
): TargetRectState {
  const [state, setState] = useState<TargetRectState>(targetId ? { status: "searching" } : { status: "idle" });

  // Resetting to "searching"/"idle" whenever targetId or retryToken changes
  // is a render-time state adjustment (React's recommended pattern for
  // "reset state when a prop changes"), not an effect side effect — it
  // must run synchronously during render, not be deferred into an effect.
  const searchKey = `${targetId ?? "none"}:${retryToken}`;
  const [prevSearchKey, setPrevSearchKey] = useState(searchKey);
  if (searchKey !== prevSearchKey) {
    setPrevSearchKey(searchKey);
    setState(targetId ? { status: "searching" } : { status: "idle" });
  }

  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (!targetId) return;

    // Reassigned to a local const so it stays narrowed to non-null inside
    // the closures below (TS drops narrowing on a captured parameter).
    const id: OnboardingTargetId = targetId;

    let cancelled = false;
    hasScrolledRef.current = false;

    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let currentElement: HTMLElement | null = null;

    function measure(element: HTMLElement) {
      if (cancelled) return;
      const rect = element.getBoundingClientRect();
      setState({ status: "found", rect, element });
    }

    function attachObservers(element: HTMLElement) {
      currentElement = element;
      resizeObserver = new ResizeObserver(() => measure(element));
      resizeObserver.observe(element);

      if (!hasScrolledRef.current) {
        hasScrolledRef.current = true;
        const rect = element.getBoundingClientRect();
        const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if (!fullyVisible) {
          element.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
        }
      }

      measure(element);
    }

    function tryFind(): boolean {
      const element = document.querySelector<HTMLElement>(onboardingTargetSelector(id));
      if (element && element !== currentElement) {
        attachObservers(element);
        return true;
      }
      if (element && element === currentElement) {
        measure(element);
        return true;
      }
      return false;
    }

    const onViewportChange = () => {
      if (currentElement) measure(currentElement);
    };
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, { capture: true, passive: true });
    window.addEventListener("orientationchange", onViewportChange);

    if (!tryFind()) {
      pollTimer = setInterval(() => {
        if (tryFind() && pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }, POLL_INTERVAL_MS);

      // Re-check on DOM mutations too (e.g. a modal/sheet just mounted the target).
      mutationObserver = new MutationObserver(() => tryFind());
      mutationObserver.observe(document.body, { childList: true, subtree: true });

      timeoutTimer = setTimeout(() => {
        if (cancelled) return;
        if (!currentElement) setState({ status: "missing" });
      }, SEARCH_TIMEOUT_MS);
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, { capture: true });
      window.removeEventListener("orientationchange", onViewportChange);
    };
  }, [targetId, retryToken]);

  return state;
}
