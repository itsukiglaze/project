"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { CURRENT_ONBOARDING_VERSION, ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding/steps";
import { persistOnboardingStatus } from "@/lib/onboarding/api";

type LaunchMode = "auto" | "manual";
type StepPhase = "step" | "post-action";

interface OnboardingContextValue {
  isOpen: boolean;
  /** Whether the "Закрыть обучение?" confirmation is currently shown over the tutorial. */
  isConfirmingClose: boolean;
  launchMode: LaunchMode | null;
  currentStep: OnboardingStep | null;
  currentStepIndex: number;
  totalSteps: number;
  phase: StepPhase;
  /** A brief confirmation message to show after skipping (e.g. "Обучение можно снова открыть в настройках."). Rendered independently of isOpen, since skip() closes the tutorial immediately. */
  toastMessage: string | null;
  dismissToast: () => void;
  start: (mode: LaunchMode) => void;
  /** Called once the current step's required action has actually happened (real tap detected, or the acknowledge button pressed). */
  advance: () => void;
  /** Reviews the previous step's dialogue. A no-op at step 0. */
  back: () => void;
  skip: () => void;
  /** Invoked by BackButton/Escape/browser-back/a close control — opens the confirmation, never closes directly. */
  requestClose: () => void;
  confirmClose: () => void;
  cancelClose: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  isOpen: false,
  isConfirmingClose: false,
  launchMode: null,
  currentStep: null,
  currentStepIndex: 0,
  totalSteps: ONBOARDING_STEPS.length,
  phase: "step",
  toastMessage: null,
  dismissToast: () => undefined,
  start: () => undefined,
  advance: () => undefined,
  back: () => undefined,
  skip: () => undefined,
  requestClose: () => undefined,
  confirmClose: () => undefined,
  cancelClose: () => undefined,
});

export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext);
}

/** Small defer so auto-start begins once the app shell (bottom nav, etc.) has actually mounted, not mid first-paint. */
const AUTO_START_DEFER_MS = 300;
const SKIP_TOAST_MS = 4000;
const SKIP_TOAST_MESSAGE = "Обучение можно снова открыть в настройках.";

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);
  const [launchMode, setLaunchMode] = useState<LaunchMode | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [phase, setPhase] = useState<StepPhase>("step");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const autoStartAttemptedRef = useRef(false);

  const dismissToast = useCallback(() => setToastMessage(null), []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), SKIP_TOAST_MS);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const start = useCallback((mode: LaunchMode) => {
    setLaunchMode(mode);
    setCurrentStepIndex(0);
    setPhase("step");
    setIsConfirmingClose(false);
    setIsOpen(true);
    setToastMessage(null);
  }, []);

  // Auto-start once per session, right after auth resolves, but only for a
  // user who hasn't already completed or skipped the current tutorial
  // version (a version bump makes an old completion/skip stale on purpose).
  useEffect(() => {
    if (autoStartAttemptedRef.current) return;
    if (status !== "authenticated" || !user) return;
    autoStartAttemptedRef.current = true;

    const hasSeenCurrentVersion =
      user.onboardingVersion === CURRENT_ONBOARDING_VERSION && user.onboardingOutcome !== null;
    if (hasSeenCurrentVersion) return;

    const timer = setTimeout(() => start("auto"), AUTO_START_DEFER_MS);
    return () => clearTimeout(timer);
  }, [status, user, start]);

  const resetTransientState = useCallback(() => {
    setIsOpen(false);
    setIsConfirmingClose(false);
    setLaunchMode(null);
    setCurrentStepIndex(0);
    setPhase("step");
  }, []);

  // Deliberately does not wait for a specific pathname here: when the next
  // step's target lives on another route, useOnboardingTargetRect's own
  // polling + MutationObserver already waits for that route's DOM to render
  // (and fails gracefully to "missing" on its own bounded timeout), so the
  // step index can just advance immediately without a second, redundant
  // route-matching mechanism here.
  const advance = useCallback(() => {
    const step = ONBOARDING_STEPS[currentStepIndex];
    if (!step) return;

    if (phase === "step" && step.postActionAcknowledge) {
      setPhase("post-action");
      return;
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= ONBOARDING_STEPS.length) {
      void persistOnboardingStatus(CURRENT_ONBOARDING_VERSION, "COMPLETED");
      resetTransientState();
      return;
    }

    setCurrentStepIndex(nextIndex);
    setPhase("step");
  }, [currentStepIndex, phase, resetTransientState]);

  // Undoes a post-action reveal first (shows the tap_target step itself
  // again) before stepping back to the previous step index.
  const back = useCallback(() => {
    if (phase === "post-action") {
      setPhase("step");
      return;
    }
    setCurrentStepIndex((i) => Math.max(0, i - 1));
  }, [phase]);

  const skip = useCallback(() => {
    void persistOnboardingStatus(CURRENT_ONBOARDING_VERSION, "SKIPPED");
    resetTransientState();
    setToastMessage(SKIP_TOAST_MESSAGE);
  }, [resetTransientState]);

  const requestClose = useCallback(() => {
    setIsConfirmingClose(true);
  }, []);

  const cancelClose = useCallback(() => {
    setIsConfirmingClose(false);
  }, []);

  // An automatic first-run close is treated like a skip (otherwise the
  // tutorial would reopen every launch). A manual restart's close leaves
  // stored completion state untouched, per the spec's explicit rule.
  const confirmClose = useCallback(() => {
    if (launchMode === "auto") {
      void persistOnboardingStatus(CURRENT_ONBOARDING_VERSION, "SKIPPED");
    }
    resetTransientState();
  }, [launchMode, resetTransientState]);

  const currentStep = isOpen ? (ONBOARDING_STEPS[currentStepIndex] ?? null) : null;

  const value = useMemo<OnboardingContextValue>(
    () => ({
      isOpen,
      isConfirmingClose,
      launchMode,
      currentStep,
      currentStepIndex,
      totalSteps: ONBOARDING_STEPS.length,
      phase,
      toastMessage,
      dismissToast,
      start,
      advance,
      back,
      skip,
      requestClose,
      confirmClose,
      cancelClose,
    }),
    [
      isOpen,
      isConfirmingClose,
      launchMode,
      currentStep,
      currentStepIndex,
      phase,
      toastMessage,
      dismissToast,
      start,
      advance,
      back,
      skip,
      requestClose,
      confirmClose,
      cancelClose,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
