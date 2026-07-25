"use client";

export function TargetMissingPanel({
  onRetry,
  onSkipStep,
  onClose,
}: {
  onRetry: () => void;
  onSkipStep: () => void;
  onClose: () => void;
}) {
  return (
    <div
      data-onboarding-ui="true"
      role="alertdialog"
      aria-modal="true"
      aria-label="Не удалось найти этот элемент."
      className="pointer-events-auto fixed inset-x-4 bottom-[calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom))+16px)] z-[62] mx-auto max-w-sm space-y-3 rounded-2xl bg-surface p-4 shadow-2xl"
    >
      <p className="text-sm font-bold">Не удалось найти этот элемент.</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-xl bg-accent-yellow text-sm font-bold text-black"
        >
          Повторить
        </button>
        <button
          type="button"
          onClick={onSkipStep}
          className="min-h-11 rounded-xl border border-border text-sm font-semibold"
        >
          Пропустить шаг
        </button>
        <button type="button" onClick={onClose} className="min-h-11 text-xs font-medium text-muted underline">
          Закрыть обучение
        </button>
      </div>
    </div>
  );
}
