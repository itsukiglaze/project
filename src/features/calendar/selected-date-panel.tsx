"use client";

import type { LocalDate } from "@/lib/calendar-math";
import { formatHumanDate } from "./date-format";
import { CURRENCY_TYPE_LABELS, INCOME_SOURCE_LABELS, TRANSACTION_TYPE_LABELS } from "./labels";
import type { MergedOccurrenceDto } from "./api";

function occurrenceKey(occurrence: MergedOccurrenceDto): string {
  return occurrence.kind === "actual" ? occurrence.id : `${occurrence.seriesId}-${occurrence.occurrenceDate}`;
}

function occurrenceLabel(occurrence: MergedOccurrenceDto): string {
  const typeLabel = TRANSACTION_TYPE_LABELS[occurrence.type];
  const sourceLabel = occurrence.source ? ` · ${INCOME_SOURCE_LABELS[occurrence.source]}` : "";
  const forecastTag = occurrence.kind === "virtual" ? " · прогноз" : "";
  return `${typeLabel}${sourceLabel}${forecastTag}`;
}

function occurrenceAmount(occurrence: MergedOccurrenceDto): string {
  const currency = occurrence.currencyType ? ` ${CURRENCY_TYPE_LABELS[occurrence.currencyType]}` : "";
  return `${occurrence.amount}${currency}`;
}

/**
 * The always-visible "selected date" summary below the calendar grid —
 * makes clicking a date visibly do something immediately, distinct from
 * the deeper day-detail sheet (still reachable via "Подробнее") that owns
 * actually adding/editing/deleting a transaction for that day.
 */
export function SelectedDatePanel({
  date,
  hasAnySource,
  occurrences,
  onOpenDetails,
}: {
  date: LocalDate | null;
  hasAnySource: boolean;
  occurrences: MergedOccurrenceDto[];
  onOpenDetails: () => void;
}) {
  if (!date) return null;

  return (
    <section aria-live="polite" className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">{formatHumanDate(date)}</h2>

      {occurrences.length === 0 ? (
        <p className="text-xs text-muted">
          {hasAnySource
            ? "На эту дату поступлений нет."
            : "Добавьте источник, чтобы увидеть будущие поступления на календаре."}
        </p>
      ) : (
        <ul className="space-y-1">
          {occurrences.map((occurrence) => (
            <li key={occurrenceKey(occurrence)} className="flex items-center justify-between text-xs">
              <span>{occurrenceLabel(occurrence)}</span>
              <span className="font-semibold">{occurrenceAmount(occurrence)}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onOpenDetails}
        className="min-h-11 w-full rounded-xl border border-border text-xs font-semibold"
      >
        Подробнее и добавить операцию
      </button>
    </section>
  );
}
