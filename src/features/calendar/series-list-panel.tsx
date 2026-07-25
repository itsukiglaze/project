"use client";

import {
  CURRENCY_TYPE_LABELS,
  INCOME_SOURCE_LABELS,
  RECURRENCE_FREQUENCY_LABELS,
  TRANSACTION_TYPE_LABELS,
} from "./labels";
import { getNextOccurrenceDate } from "./next-occurrence";
import { formatHumanDate } from "./date-format";
import { getTodayLocalDate } from "./local-date-client";
import type { SeriesRecordDto } from "./api";
import type { QueryState } from "@/lib/query/use-query";

/** The source's plain-Russian name — its income source when it has one, otherwise its type (e.g. "Расход"). */
function sourceLabel(series: SeriesRecordDto): string {
  return series.source ? INCOME_SOURCE_LABELS[series.source] : TRANSACTION_TYPE_LABELS[series.type];
}

export function SeriesListPanel({
  query,
  onCreate,
  onEdit,
  onDelete,
}: {
  query: QueryState<{ series: SeriesRecordDto[] }> & { refetch: () => void };
  onCreate: () => void;
  onEdit: (series: SeriesRecordDto) => void;
  onDelete: (series: SeriesRecordDto) => void;
}) {
  const today = getTodayLocalDate();

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Регулярные источники</h2>
        <button
          type="button"
          onClick={onCreate}
          className="min-h-8 rounded-full bg-accent-yellow px-3 text-xs font-semibold text-black"
        >
          + Добавить источник
        </button>
      </div>

      {query.status === "loading" && (
        <div className="animate-pulse rounded-xl bg-border" style={{ height: 60 }} />
      )}

      {query.status !== "loading" && query.status !== "success" && (
        <div role="alert" className="space-y-2">
          <p className="text-xs text-accent-red">Не удалось загрузить регулярные источники.</p>
          <button
            type="button"
            onClick={query.refetch}
            className="min-h-11 w-full rounded-xl bg-surface-contrast text-xs font-semibold text-background"
          >
            Повторить загрузку источников
          </button>
        </div>
      )}

      {query.status === "success" && query.data.series.length === 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted">Регулярных источников пока нет.</p>
          <p className="text-xs text-muted">
            Например: ежедневные задания, еженедельные награды, пропуск или событие.
          </p>
        </div>
      )}

      {query.status === "success" &&
        query.data.series.map((series) => {
          const name = sourceLabel(series);
          const next = series.isActive ? getNextOccurrenceDate(series.rule, today) : null;
          return (
            <div
              key={series.id}
              className="flex items-center justify-between rounded-xl border border-border p-3"
            >
              <div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-xs text-muted">
                  {RECURRENCE_FREQUENCY_LABELS[series.rule.frequency]} · {series.amount}
                  {series.currencyType ? ` ${CURRENCY_TYPE_LABELS[series.currencyType]}` : ""}
                </p>
                {next && (
                  <p className="text-xs text-muted">Следующее ожидается {formatHumanDate(next)}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(series)}
                  aria-label={`Изменить источник «${name}»`}
                  className="min-h-11 rounded-lg border border-border px-3 text-xs font-semibold"
                >
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(series)}
                  aria-label={`Удалить источник «${name}»`}
                  className="min-h-11 rounded-lg border border-accent-red/40 px-3 text-xs font-semibold text-accent-red"
                >
                  Удалить
                </button>
              </div>
            </div>
          );
        })}
    </section>
  );
}
