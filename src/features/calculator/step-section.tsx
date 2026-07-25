"use client";

import type { OnboardingTargetId } from "@/lib/onboarding/targets";
import { onboardingTargetAttr } from "@/components/onboarding/target-attach";

/**
 * Wraps one numbered step of the calculator flow. Plain, undecorated step
 * numbers — a small muted "Шаг N." prefix, not a badge/circle/progress
 * graphic — per the explicit "do not overdecorate" requirement. All steps
 * stay on one scrollable page (this is not a multi-page wizard).
 */
export function StepSection({
  step,
  title,
  children,
  onboardingTarget,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
  onboardingTarget?: OnboardingTargetId;
}) {
  const headingId = `calculator-step-${step}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-3 rounded-2xl border border-border bg-surface p-4"
      {...(onboardingTarget ? onboardingTargetAttr(onboardingTarget) : {})}
    >
      <h2 id={headingId} className="text-sm font-bold">
        <span className="text-muted">Шаг {step}.</span> {title}
      </h2>
      {children}
    </section>
  );
}
