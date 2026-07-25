"use client";

import { useRef } from "react";
import { useFocusTrap } from "@/features/calendar/use-focus-trap";
import type { OnboardingStep } from "@/lib/onboarding/steps";
import { ONBOARDING_TARGET_DESCRIPTIONS } from "@/lib/onboarding/targets";

export function OnboardingDialogueCard({
  step,
  phase,
  stepIndex,
  totalSteps,
  onAdvance,
  onBack,
  onSkip,
  position,
}: {
  step: OnboardingStep;
  phase: "step" | "post-action";
  stepIndex: number;
  totalSteps: number;
  onAdvance: () => void;
  onBack: () => void;
  onSkip: () => void;
  /** "top" when the real target sits low in the viewport (e.g. the bottom nav) — otherwise the card would visually sit on top of it and swallow its clicks. */
  position: "top" | "bottom";
}) {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const isWaitingForRealTap = phase === "step" && step.requiredAction === "tap_target";

  // While waiting for a real tap on the target, the trap must not wrap Tab
  // inside the card only — the target itself needs to stay reachable by
  // keyboard too (see onboarding-overlay.tsx's tabindex suppression, which
  // is what actually keeps focus confined to {card controls, target}).
  // Escape is handled once, globally, by the overlay's own document
  // listener — passing a no-op here (rather than onRequestClose) avoids
  // firing requestClose twice for a single Escape press.
  const containerRef = useFocusTrap<HTMLDivElement>(() => undefined, {
    initialFocusRef: primaryButtonRef,
    active: !isWaitingForRealTap,
  });

  const postAction = phase === "post-action" ? step.postActionAcknowledge : undefined;
  const title = postAction?.title ?? step.title;
  const body = postAction?.body ?? step.body;
  const primaryLabel = postAction?.buttonLabel ?? step.acknowledgeLabel ?? "Далее";
  const targetDescription = step.target ? ONBOARDING_TARGET_DESCRIPTIONS[step.target] : null;
  const positionClass =
    position === "top"
      ? "top-[calc(var(--tg-content-safe-area-inset-top,env(safe-area-inset-top))+16px)]"
      : "bottom-[calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom))+16px)]";

  return (
    <div
      ref={containerRef}
      data-onboarding-ui="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-dialogue-title"
      tabIndex={-1}
      className={`pointer-events-auto fixed inset-x-4 z-[62] mx-auto max-w-sm space-y-2 rounded-2xl bg-surface p-4 shadow-2xl ${positionClass}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-yellow">Прокси-помощник</p>
      <p role="status" className="sr-only">
        Шаг {stepIndex + 1} из {totalSteps}
      </p>
      {targetDescription && <p className="sr-only">Выделенный элемент: {targetDescription}</p>}

      <h2 id="onboarding-dialogue-title" className="text-base font-bold">
        {title}
      </h2>
      <p className="text-sm text-muted">{body}</p>
      {phase === "step" && step.note && <p className="text-xs text-muted/80">{step.note}</p>}
      {isWaitingForRealTap && step.instruction && (
        <p className="text-xs font-semibold text-foreground">{step.instruction}</p>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <span aria-hidden="true" className="text-xs text-muted">
          Шаг {stepIndex + 1} из {totalSteps}
        </span>
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold"
            >
              Назад
            </button>
          )}
          {!isWaitingForRealTap && (
            <button
              ref={primaryButtonRef}
              type="button"
              onClick={onAdvance}
              className="min-h-11 rounded-xl bg-accent-yellow px-4 text-sm font-bold text-black"
            >
              {primaryLabel}
            </button>
          )}
        </div>
      </div>

      <button type="button" onClick={onSkip} className="min-h-11 w-full text-xs font-medium text-muted underline">
        Пропустить
      </button>
    </div>
  );
}
