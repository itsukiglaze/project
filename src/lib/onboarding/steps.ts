import type { OnboardingTargetId } from "./targets";

/** Bump when the tutorial content changes meaningfully enough to show it again to users who already completed/skipped an older version. */
export const CURRENT_ONBOARDING_VERSION = 1;

export type RequiredAction =
  /** User must tap the real, highlighted target element. */
  | "tap_target"
  /** No real action required — user presses "Понятно"/"Далее"/a custom label. */
  | "acknowledge"
  /** User completes a small, safe, reversible real action (not used in v1 — reserved). */
  | "complete_action";

export type CharacterPlacement = "left-bottom" | "right-bottom" | "left-center" | "right-center";

export interface OnboardingStep {
  id: string;
  /** The route this step's target lives on. The tutorial waits for navigation to this route before searching for the target. */
  route: string;
  /** `null` for steps with no specific real element to spotlight (e.g. the welcome step). */
  target: OnboardingTargetId | null;
  title: string;
  body: string;
  /** A shorter secondary line shown under `body`, e.g. a caveat ("Калькулятор ничего не списывает…"). */
  note?: string;
  /** The imperative instruction line ("Нажмите «Настройки»."), shown only for tap_target steps. */
  instruction?: string;
  requiredAction: RequiredAction;
  /** Label for the acknowledge button. Defaults to "Далее" (or "Начать обучение" for step 1, set explicitly). */
  acknowledgeLabel?: string;
  characterPlacement: CharacterPlacement;
  /**
   * Shown in place after a tap_target step's action fires, before
   * advancing — lets a step explain something about what just happened
   * (e.g. "это фактический баланс, а не запланированный доход") without
   * inflating the step count with a whole separate step.
   */
  postActionAcknowledge?: { title: string; body: string; buttonLabel?: string };
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    route: "/",
    target: null,
    title: "Добро пожаловать!",
    body: "Я быстро покажу, как сохранять ресурсы, считать крутки и планировать будущие поступления.",
    requiredAction: "acknowledge",
    acknowledgeLabel: "Начать обучение",
    characterPlacement: "right-bottom",
  },
  {
    id: "settings-tab",
    route: "/",
    target: "settings-tab",
    title: "Сначала — текущие данные",
    body: "В настройках сохраняются ваши ресурсы и pity. Они автоматически используются в расчётах.",
    instruction: "Нажмите «Настройки».",
    requiredAction: "tap_target",
    characterPlacement: "right-bottom",
  },
  {
    id: "resource-balance",
    route: "/settings",
    target: "resource-balance",
    title: "Обновляйте баланс",
    body: "Введите, сколько ресурсов у вас сейчас, и нажмите «Просмотреть изменения» — приложение покажет, что изменится перед сохранением.",
    instruction: "Нажмите «Просмотреть изменения».",
    requiredAction: "tap_target",
    characterPlacement: "left-bottom",
    postActionAcknowledge: {
      title: "Обновляйте баланс",
      body: "Это фактический баланс, а не запланированный доход.",
      buttonLabel: "Далее",
    },
  },
  {
    id: "calculator-tab",
    route: "/settings",
    target: "calculator-tab",
    title: "Проверьте, хватит ли на цель",
    body: "Калькулятор использует сохранённые ресурсы и pity или временные значения.",
    instruction: "Откройте калькулятор.",
    requiredAction: "tap_target",
    characterPlacement: "right-bottom",
  },
  {
    id: "banner-selector",
    route: "/calculator",
    target: "banner-selector",
    title: "Выберите баннер и цель",
    body: "Укажите тип баннера и желаемую цель — например S0–S6. Расчёт покажет гарантированный худший сценарий.",
    note: "Калькулятор ничего не списывает и не изменяет в профиле.",
    requiredAction: "acknowledge",
    characterPlacement: "left-bottom",
  },
  {
    id: "calendar-tab",
    route: "/calculator",
    target: "calendar-tab",
    title: "Планируйте поступления",
    body: "В календаре можно добавить регулярный источник, разовую сумму или посмотреть будущие поступления.",
    instruction: "Откройте календарь.",
    requiredAction: "tap_target",
    characterPlacement: "right-bottom",
  },
  {
    id: "calendar-actions",
    route: "/calendar",
    target: "calendar-actions",
    title: "Три разных действия",
    body: "Источник — повторяющееся поступление. Сумма — разовое получение или расход. Баланс — сколько ресурсов у вас фактически сейчас.",
    requiredAction: "acknowledge",
    acknowledgeLabel: "Завершить",
    characterPlacement: "left-bottom",
  },
];
