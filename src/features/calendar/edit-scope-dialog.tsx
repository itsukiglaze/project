"use client";

import { useFocusTrap } from "./use-focus-trap";

export type EditScope = "THIS" | "THIS_AND_FUTURE" | "ALL";

export function EditScopeDialog({
  onSelect,
  onCancel,
}: {
  onSelect: (scope: EditScope) => void;
  onCancel: () => void;
}) {
  const containerRef = useFocusTrap<HTMLDivElement>(onCancel);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Область изменения"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
    >
      <div
        className="w-full max-w-lg space-y-2 rounded-t-2xl bg-surface p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <h2 className="text-sm font-bold">Что изменить?</h2>
        <button
          type="button"
          onClick={() => onSelect("THIS")}
          className="min-h-11 w-full rounded-xl border border-border px-3 text-left text-sm font-semibold"
        >
          Только это вхождение
        </button>
        <button
          type="button"
          onClick={() => onSelect("THIS_AND_FUTURE")}
          className="min-h-11 w-full rounded-xl border border-border px-3 text-left text-sm font-semibold"
        >
          Это и будущие вхождения
        </button>
        <button
          type="button"
          onClick={() => onSelect("ALL")}
          className="min-h-11 w-full rounded-xl border border-border px-3 text-left text-sm font-semibold"
        >
          Всю серию
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 w-full rounded-xl text-sm font-semibold text-muted"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
