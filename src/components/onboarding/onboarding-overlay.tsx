"use client";

import { useEffect, useState } from "react";
import { useOnboarding } from "./onboarding-provider";
import { useOnboardingTargetRect } from "./use-target-rect";
import { OnboardingCharacter } from "./character-image";
import { OnboardingDialogueCard } from "./dialogue-card";
import { OnboardingCloseConfirm } from "./onboarding-close-confirm";
import { TargetMissingPanel } from "./target-missing-panel";
import { SpotlightMask } from "./spotlight-mask";
import { pickCharacterPlacement } from "@/lib/onboarding/pick-placement";
import { showBackButton, hideBackButton } from "@/lib/telegram/webapp";

const SEARCHING_HINT_DELAY_MS = 600;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function usesReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function OnboardingOverlay() {
  const {
    isOpen,
    isConfirmingClose,
    currentStep,
    currentStepIndex,
    totalSteps,
    phase,
    toastMessage,
    advance,
    back,
    skip,
    requestClose,
    confirmClose,
    cancelClose,
  } = useOnboarding();
  const [retryToken, setRetryToken] = useState(0);
  const rectState = useOnboardingTargetRect(currentStep?.target ?? null, retryToken);

  // Debounced "still searching" hint. Resetting it to false when we leave
  // the "searching" status is a render-time state adjustment (React's
  // recommended pattern for reacting to a changed value), not an effect
  // side effect, so it happens synchronously during render below rather
  // than via a setState call in the effect body.
  const searchingKey = `${currentStep?.id ?? "none"}:${rectState.status}`;
  const [showSearchingHint, setShowSearchingHint] = useState(false);
  const [prevSearchingKey, setPrevSearchingKey] = useState(searchingKey);
  if (searchingKey !== prevSearchingKey) {
    setPrevSearchingKey(searchingKey);
    if (rectState.status !== "searching") setShowSearchingHint(false);
  }

  useEffect(() => {
    if (rectState.status !== "searching") return;
    const timer = setTimeout(() => setShowSearchingHint(true), SEARCHING_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [rectState.status, currentStep?.id]);

  // Telegram's own hardware/native back control — the primary "close"
  // gesture inside the Telegram WebView, where there's typically no visible
  // browser chrome to press back on otherwise.
  useEffect(() => {
    if (!isOpen) return;
    showBackButton(requestClose);
    return () => hideBackButton(requestClose);
  }, [isOpen, requestClose]);

  // The single, authoritative Escape handler for the whole tutorial —
  // sub-components (dialogue card, close-confirm) intentionally pass a
  // no-op to their own useFocusTrap so Escape is never handled twice.
  // Requests the close-confirmation normally; if it's already open,
  // Escape cancels it instead (same as pressing "Продолжить").
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (isConfirmingClose) cancelClose();
      else requestClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isConfirmingClose, requestClose, cancelClose]);

  // Confines Tab-reachability to exactly {the tutorial's own controls, the
  // spotlighted real target} while the tutorial is open, so keyboard focus
  // can never wander into dimmed background content — without needing a
  // page-wide `inert`, which would also disable the one element we need to
  // stay interactive.
  useEffect(() => {
    if (!isOpen) return;
    const targetElement = rectState.status === "found" ? rectState.element : null;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const restores: Array<() => void> = [];
    for (const element of elements) {
      if (element === targetElement) continue;
      if (element.closest('[data-onboarding-ui="true"]')) continue;
      const previous = element.getAttribute("tabindex");
      element.setAttribute("tabindex", "-1");
      restores.push(() => {
        if (previous === null) element.removeAttribute("tabindex");
        else element.setAttribute("tabindex", previous);
      });
    }
    return () => restores.forEach((restore) => restore());
  }, [isOpen, rectState, currentStepIndex, phase]);

  // Detects the real interaction with the target for tap_target steps.
  // Never calls preventDefault/stopPropagation — the click (or the
  // synthetic click a browser fires for a keyboard Enter/Space activation)
  // must still reach the real element so its actual behavior (navigation,
  // opening a form, etc.) genuinely happens.
  useEffect(() => {
    if (!isOpen) return;
    if (currentStep?.requiredAction !== "tap_target") return;
    if (phase !== "step") return;
    if (rectState.status !== "found") return;

    const element = rectState.element;
    function handleClick() {
      advance();
    }
    element.addEventListener("click", handleClick);
    return () => element.removeEventListener("click", handleClick);
  }, [isOpen, currentStep, phase, rectState, advance]);

  const toast = toastMessage ? (
    <p
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom))+16px)] z-[80] mx-auto max-w-sm rounded-xl bg-surface-contrast px-4 py-3 text-center text-sm font-medium text-background shadow-2xl"
    >
      {toastMessage}
    </p>
  ) : null;

  // Rendered even when the tutorial itself is closed — skip() closes the
  // tutorial immediately but the confirmation toast still needs to show.
  if (!isOpen || !currentStep) return toast;

  const step = currentStep;
  const reducedMotion = usesReducedMotion();
  const hasTarget = step.target !== null;
  const showSpotlight = hasTarget && rectState.status === "found";
  const showDialogue = !hasTarget || rectState.status === "found";
  const showMissing = hasTarget && rectState.status === "missing";
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 390;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 844;
  // A target low in the viewport (the bottom nav) sits directly under a
  // bottom-anchored card, silently swallowing its taps — move the card to
  // the top instead whenever that's the case.
  const dialoguePosition: "top" | "bottom" =
    rectState.status === "found" && rectState.rect.top > viewportHeight * 0.55 ? "top" : "bottom";

  return (
    // pointer-events-none on the root is deliberate: a plain `fixed inset-0`
    // wrapper still captures clicks everywhere within its box by default
    // (pointer-events is inherited), even over the spotlight "hole" where
    // no child paints anything. Every interactive piece below re-enables
    // pointer-events-auto on itself explicitly.
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {showSpotlight && rectState.status === "found" ? (
        <SpotlightMask rect={rectState.rect} reducedMotion={reducedMotion} />
      ) : (
        <div aria-hidden="true" className="pointer-events-auto fixed inset-0 bg-black/55" />
      )}

      {hasTarget && showSearchingHint && rectState.status === "searching" && (
        <p
          role="status"
          className="fixed left-1/2 top-6 z-[62] -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white"
        >
          Ищем нужный элемент…
        </p>
      )}

      {showMissing && (
        <TargetMissingPanel onRetry={() => setRetryToken((n) => n + 1)} onSkipStep={advance} onClose={requestClose} />
      )}

      {showDialogue && (
        <>
          <OnboardingCharacter
            placement={pickCharacterPlacement(
              step.characterPlacement,
              rectState.status === "found" ? rectState.rect : null,
              viewportWidth,
              viewportHeight,
            )}
          />
          <OnboardingDialogueCard
            step={step}
            phase={phase}
            stepIndex={currentStepIndex}
            totalSteps={totalSteps}
            onAdvance={advance}
            onBack={back}
            onSkip={skip}
            position={dialoguePosition}
          />
        </>
      )}

      {isConfirmingClose && <OnboardingCloseConfirm onConfirm={confirmClose} onCancel={cancelClose} />}
      {toast}
    </div>
  );
}
