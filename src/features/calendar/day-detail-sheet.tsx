"use client";

import { useState } from "react";
import { formatLocalDate, type LocalDate } from "@/lib/calendar-math";
import { TRANSACTION_TYPE_LABELS } from "./labels";
import type { MergedOccurrenceDto, TransactionInputDto } from "./api";
import { TransactionForm, type EditableTransaction } from "./transaction-form";
import { ConfirmDialog } from "./confirm-dialog";
import { useTransactionMutations } from "./use-transaction-mutations";

export type VirtualOccurrenceAction = "cancel" | "edit";

export function DayDetailSheet({
  date,
  timezone,
  occurrences,
  onClose,
  onEditSeriesOccurrence,
}: {
  date: LocalDate;
  timezone: string;
  occurrences: MergedOccurrenceDto[];
  onClose: () => void;
  /** Delegates "edit"/"cancel" on a virtual occurrence up to the page, which owns the edit-scope flow. */
  onEditSeriesOccurrence: (
    occurrence: Extract<MergedOccurrenceDto, { kind: "virtual" }>,
    action: VirtualOccurrenceAction,
  ) => void;
}) {
  const [formMode, setFormMode] = useState<"none" | "create" | EditableTransaction>("none");
  const [pendingDelete, setPendingDelete] = useState<EditableTransaction | null>(null);
  const { state, create, update, remove, resetState } = useTransactionMutations();

  const actual = occurrences.filter(
    (o): o is Extract<MergedOccurrenceDto, { kind: "actual" }> => o.kind === "actual",
  );
  const virtual = occurrences.filter(
    (o): o is Extract<MergedOccurrenceDto, { kind: "virtual" }> => o.kind === "virtual",
  );

  async function handleFormSubmit(input: TransactionInputDto) {
    if (formMode === "create") {
      const result = await create(input);
      if (result) {
        setFormMode("none");
        resetState();
      }
    } else if (formMode !== "none") {
      const result = await update(formMode.id, input, formMode.version);
      if (result) {
        setFormMode("none");
        resetState();
      }
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    const result = await remove(pendingDelete.id, pendingDelete.version);
    if (result) {
      setPendingDelete(null);
      resetState();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Детали дня ${formatLocalDate(date)}`}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">{formatLocalDate(date)}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-11 w-11 items-center justify-center"
          >
            ✕
          </button>
        </div>

        {formMode !== "none" ? (
          <TransactionForm
            date={date}
            timezone={timezone}
            existing={formMode === "create" ? undefined : formMode}
            submitting={state.status === "loading"}
            onSubmit={handleFormSubmit}
            onCancel={() => {
              setFormMode("none");
              resetState();
            }}
          />
        ) : (
          <div className="space-y-4">
            {occurrences.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">На этот день пока нет записей.</p>
            )}

            {actual.length > 0 && (
              <section aria-label="Фактические операции" className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted">Фактические операции</h3>
                {actual.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{TRANSACTION_TYPE_LABELS[tx.type]}</p>
                      <p className="text-xs text-muted">{tx.amount}</p>
                    </div>
                    {!tx.seriesId && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormMode(tx)}
                          className="min-h-11 rounded-lg border border-border px-3 text-xs font-semibold"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(tx)}
                          className="min-h-11 rounded-lg border border-accent-red/40 px-3 text-xs font-semibold text-accent-red"
                        >
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {virtual.length > 0 && (
              <section aria-label="Прогнозные вхождения серии" className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted">Из повторяющейся серии (прогноз)</h3>
                {virtual.map((occ) => (
                  <div
                    key={`${occ.seriesId}-${occ.occurrenceDate}`}
                    className="flex items-center justify-between rounded-xl border border-dashed border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{TRANSACTION_TYPE_LABELS[occ.type]}</p>
                      <p className="text-xs text-muted">{occ.amount} · оценка, не факт</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEditSeriesOccurrence(occ, "edit")}
                        className="min-h-11 rounded-lg border border-border px-3 text-xs font-semibold"
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditSeriesOccurrence(occ, "cancel")}
                        className="min-h-11 rounded-lg border border-accent-red/40 px-3 text-xs font-semibold text-accent-red"
                      >
                        Отменить
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <button
              type="button"
              onClick={() => setFormMode("create")}
              className="min-h-11 w-full rounded-xl bg-accent-yellow text-sm font-bold text-black"
            >
              Добавить операцию
            </button>
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Удалить операцию?"
          message="Это действие нельзя отменить."
          confirmLabel="Удалить"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
