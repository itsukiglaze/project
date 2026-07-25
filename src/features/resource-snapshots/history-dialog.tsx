"use client";

import { useState } from "react";
import { parseLocalDate, addDays } from "@/lib/calendar-math";
import { useAuth } from "@/components/providers/auth-provider";
import { useFocusTrap } from "@/features/calendar/use-focus-trap";
import { ConfirmDialog } from "@/features/calendar/confirm-dialog";
import { getTodayLocalDate } from "@/features/calendar/local-date-client";
import { formatHumanDate } from "@/features/calendar/date-format";
import { useSnapshotHistoryQuery } from "./use-resource-snapshot-queries";
import { useSnapshotMutations } from "./use-snapshot-mutations";
import { snapshotMutationErrorMessage } from "./mutation-state";
import { HistoryList } from "./history-list";
import { SnapshotFormDialog } from "./snapshot-form-dialog";
import type { SnapshotFormResult } from "./snapshot-form";
import type { ResourceSnapshotComparisonDto } from "./api";

/** How far back "История баланса" looks by default — a generous year, matching the API's own range cap. */
const HISTORY_LOOKBACK_DAYS = 365;

export function HistoryDialog({ onClose }: { onClose: () => void }) {
  const { status: authStatus, user } = useAuth();
  const today = getTodayLocalDate();
  const from = addDays(today, -HISTORY_LOOKBACK_DAYS);
  const query = useSnapshotHistoryQuery(from, today, authStatus === "authenticated");
  const mutations = useSnapshotMutations();

  const [editing, setEditing] = useState<ResourceSnapshotComparisonDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ResourceSnapshotComparisonDto | null>(null);
  // Suspended while a nested dialog (edit form / delete confirm) is open —
  // both own their own trap/Escape handling, and both listening at once
  // would double-handle Escape (same pattern as day-detail-sheet.tsx).
  const containerRef = useFocusTrap<HTMLDivElement>(onClose, { active: editing === null && pendingDelete === null });

  const timezone = user?.timezone ?? "UTC";

  async function handleEditSubmit(result: SnapshotFormResult) {
    if (!editing) return;
    const saved = await mutations.save(
      result.localDate,
      { timezone, note: result.note, items: result.items },
      editing.record.version,
    );
    if (saved) {
      setEditing(null);
      mutations.resetState();
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const removed = await mutations.remove(parseLocalDate(pendingDelete.record.localDate), pendingDelete.record.version);
    if (removed) {
      setPendingDelete(null);
      mutations.resetState();
    }
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="История баланса"
      tabIndex={-1}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">История баланса</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-11 w-11 items-center justify-center">
            ✕
          </button>
        </div>

        {query.status === "loading" && (
          <div className="animate-pulse rounded-xl bg-border" style={{ height: 120 }} />
        )}

        {query.status === "error" && (
          <div role="alert" className="space-y-2">
            <p className="text-xs text-accent-red">Не удалось загрузить историю баланса.</p>
            <button
              type="button"
              onClick={query.refetch}
              className="min-h-11 w-full rounded-xl bg-surface-contrast text-xs font-semibold text-background"
            >
              Повторить загрузку истории
            </button>
          </div>
        )}

        {query.status === "success" && (
          <HistoryList
            snapshots={query.data.snapshots}
            onEdit={setEditing}
            onDelete={setPendingDelete}
          />
        )}
      </div>

      {editing && (
        <SnapshotFormDialog
          today={today}
          prefillItems={editing.record.items}
          existingDate={parseLocalDate(editing.record.localDate)}
          existingNote={editing.record.note}
          submitting={mutations.state.status === "loading"}
          errorMessage={snapshotMutationErrorMessage(mutations.state)}
          onCancel={() => setEditing(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Удалить сохранённый баланс?"
          message={`Баланс за ${formatHumanDate(parseLocalDate(pendingDelete.record.localDate), true)} будет удалён. Сравнение для соседних дат пересчитается автоматически.`}
          confirmLabel="Удалить"
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
