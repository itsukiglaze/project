"use client";

import { useRef } from "react";
import { useFocusTrap } from "@/features/calendar/use-focus-trap";

export function OnboardingCloseConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  // Escape is handled once, globally, by the overlay's own document
  // listener (which calls cancelClose while this dialog is open) — a
  // no-op here avoids firing onCancel twice for a single Escape press.
  const containerRef = useFocusTrap<HTMLDivElement>(() => undefined, { initialFocusRef: continueButtonRef });

  return (
    <div
      data-onboarding-ui="true"
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Закрыть обучение?"
      tabIndex={-1}
      className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-4">
        <h2 className="text-sm font-bold">Закрыть обучение?</h2>
        <p className="text-xs text-muted">Его можно снова пройти в настройках.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 flex-1 rounded-xl border border-border text-sm font-semibold"
          >
            Закрыть
          </button>
          <button
            ref={continueButtonRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-xl bg-accent-yellow text-sm font-bold text-black"
          >
            Продолжить
          </button>
        </div>
      </div>
    </div>
  );
}
