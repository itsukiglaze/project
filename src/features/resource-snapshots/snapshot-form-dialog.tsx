"use client";

import type { LocalDate } from "@/lib/calendar-math";
import { useFocusTrap } from "@/features/calendar/use-focus-trap";
import { SnapshotForm, type SnapshotFormResult } from "./snapshot-form";
import type { ResourceSnapshotItemDto } from "./api";

export function SnapshotFormDialog({
  today,
  prefillItems,
  existingDate,
  existingNote,
  submitting,
  errorMessage,
  onSubmit,
  onCancel,
}: {
  today: LocalDate;
  prefillItems: ResourceSnapshotItemDto[];
  existingDate?: LocalDate;
  existingNote?: string | null;
  submitting: boolean;
  /** A visible reason the previous attempt didn't save — e.g. a stale-version conflict. `null`/omitted shows nothing. */
  errorMessage?: string | null;
  onSubmit: (result: SnapshotFormResult) => void;
  onCancel: () => void;
}) {
  const containerRef = useFocusTrap<HTMLDivElement>(onCancel);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Обновить баланс"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <h2 className="mb-3 text-base font-bold">Обновить баланс</h2>
        {errorMessage && (
          <p role="alert" className="mb-3 text-xs text-accent-red">
            {errorMessage}
          </p>
        )}
        <SnapshotForm
          today={today}
          prefillItems={prefillItems}
          existingDate={existingDate}
          existingNote={existingNote}
          submitting={submitting}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
