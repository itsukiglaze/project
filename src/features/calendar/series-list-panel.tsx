"use client";

import { RECURRENCE_FREQUENCY_LABELS, TRANSACTION_TYPE_LABELS } from "./labels";
import type { SeriesRecordDto } from "./api";
import type { QueryState } from "./use-calendar-query";

export function SeriesListPanel({
  query,
  onCreate,
  onEdit,
  onDelete,
}: {
  query: QueryState<{ series: SeriesRecordDto[] }>;
  onCreate: () => void;
  onEdit: (series: SeriesRecordDto) => void;
  onDelete: (series: SeriesRecordDto) => void;
}) {
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Повторяющиеся серии</h2>
        <button
          type="button"
          onClick={onCreate}
          className="min-h-8 rounded-full bg-accent-yellow px-3 text-xs font-semibold text-black"
        >
          + Новая
        </button>
      </div>

      {query.status === "loading" && (
        <div className="animate-pulse rounded-xl bg-border" style={{ height: 60 }} />
      )}

      {query.status !== "loading" && query.status !== "success" && (
        <p role="alert" className="text-xs text-accent-red">
          Не удалось загрузить серии.
        </p>
      )}

      {query.status === "success" && query.data.series.length === 0 && (
        <p className="text-xs text-muted">Пока нет ни одной повторяющейся серии.</p>
      )}

      {query.status === "success" &&
        query.data.series.map((series) => (
          <div
            key={series.id}
            className="flex items-center justify-between rounded-xl border border-border p-3"
          >
            <div>
              <p className="text-sm font-semibold">
                {TRANSACTION_TYPE_LABELS[series.type]} · {series.amount}
              </p>
              <p className="text-xs text-muted">{RECURRENCE_FREQUENCY_LABELS[series.rule.frequency]}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(series)}
                className="min-h-11 rounded-lg border border-border px-3 text-xs font-semibold"
              >
                Изменить
              </button>
              <button
                type="button"
                onClick={() => onDelete(series)}
                className="min-h-11 rounded-lg border border-accent-red/40 px-3 text-xs font-semibold text-accent-red"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
    </section>
  );
}
