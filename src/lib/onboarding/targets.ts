/**
 * Central typed registry of every real UI element the onboarding tutorial
 * can spotlight. Targets are looked up at runtime via
 * `[data-onboarding-target="<id>"]` (see use-target-rect.ts) — never via
 * CSS class names or text matching, and never via hardcoded pixel
 * coordinates. Adding a new step's target means adding one entry here and
 * attaching it to the real element with `OnboardingTarget` or
 * `onboardingTargetAttr()` (see target-attach.tsx) — no scattered string
 * literals anywhere else.
 */
export type OnboardingTargetId =
  | "settings-tab"
  | "resource-balance"
  | "calculator-tab"
  | "banner-selector"
  | "calendar-tab"
  | "calendar-actions"
  | "statistics-tab";

export const ONBOARDING_TARGETS: Record<OnboardingTargetId, OnboardingTargetId> = {
  "settings-tab": "settings-tab",
  "resource-balance": "resource-balance",
  "calculator-tab": "calculator-tab",
  "banner-selector": "banner-selector",
  "calendar-tab": "calendar-tab",
  "calendar-actions": "calendar-actions",
  "statistics-tab": "statistics-tab",
};

export function onboardingTargetSelector(id: OnboardingTargetId): string {
  return `[data-onboarding-target="${id}"]`;
}

/** Screen-reader description of each real target, read alongside the dialogue card's title/body. */
export const ONBOARDING_TARGET_DESCRIPTIONS: Record<OnboardingTargetId, string> = {
  "settings-tab": "Вкладка «Настройки» в нижней навигации.",
  "resource-balance": "Кнопка «Просмотреть изменения» в форме ресурсов.",
  "calculator-tab": "Вкладка «Калькулятор» в нижней навигации.",
  "banner-selector": "Блок выбора типа баннера.",
  "calendar-tab": "Вкладка «Календарь» в нижней навигации.",
  "calendar-actions": "Панель действий календаря: источник, сумма, баланс.",
  "statistics-tab": "Вкладка «Статистика» в нижней навигации.",
};
