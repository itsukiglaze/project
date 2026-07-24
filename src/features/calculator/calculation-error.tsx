"use client";

import type { CalculatorUiState } from "./types";

type ErrorUiState = Extract<
  CalculatorUiState,
  { status: "validation_error" | "auth_error" | "network_error" | "unknown_error" }
>;

const TITLES: Record<ErrorUiState["status"], string> = {
  validation_error: "Проверьте данные",
  auth_error: "Нужно войти через Telegram",
  network_error: "Нет соединения",
  unknown_error: "Что-то пошло не так",
};

function messageFor(state: ErrorUiState): string {
  if (state.status === "network_error") {
    return "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.";
  }
  return state.message;
}

export function CalculationError({
  state,
  onRetry,
}: {
  state: ErrorUiState;
  onRetry: () => void;
}) {
  return (
    <section role="alert" className="space-y-3 rounded-2xl border border-accent-red/40 bg-accent-red/5 p-4">
      <h2 className="text-sm font-bold text-accent-red">{TITLES[state.status]}</h2>
      <p className="text-xs text-muted">{messageFor(state)}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 w-full rounded-xl bg-surface-contrast text-sm font-semibold text-background"
      >
        Повторить
      </button>
    </section>
  );
}
