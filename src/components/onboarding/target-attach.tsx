"use client";

import type { OnboardingTargetId } from "@/lib/onboarding/targets";

/**
 * Spread directly onto an existing element (button, Link, etc.) so
 * attaching a target never requires wrapping it in an extra DOM node that
 * could disrupt its layout (e.g. a flex child in the bottom nav).
 */
export function onboardingTargetAttr(id: OnboardingTargetId): { "data-onboarding-target": OnboardingTargetId } {
  return { "data-onboarding-target": id };
}

/**
 * Wraps block-level content that has no single existing element to spread
 * the attribute onto (e.g. a whole card/section). Renders a plain `div`
 * with no layout opinions of its own — callers still control sizing via
 * `className`.
 */
export function OnboardingTarget({
  id,
  className,
  children,
}: {
  id: OnboardingTargetId;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-onboarding-target={id} className={className}>
      {children}
    </div>
  );
}
