"use client";

import type { LocalDate } from "@/lib/calendar-math";
import { useFocusTrap } from "./use-focus-trap";
import { useTransactionMutations } from "./use-transaction-mutations";
import { QuickAmountForm } from "./quick-amount-form";

export function QuickAmountFormDialog({
  date,
  timezone,
  onClose,
}: {
  date: LocalDate;
  timezone: string;
  onClose: () => void;
}) {
  const { state, create } = useTransactionMutations();
  const containerRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Добавить сумму"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <h2 className="mb-3 text-base font-bold">Добавить сумму</h2>
        <QuickAmountForm
          date={date}
          timezone={timezone}
          submitting={state.status === "loading"}
          onCancel={onClose}
          onSubmit={async (input) => {
            const result = await create(input);
            if (result) onClose();
          }}
        />
      </div>
    </div>
  );
}
