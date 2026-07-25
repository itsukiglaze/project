"use client";

import { compareLocalDate, formatLocalDate, type LocalDate } from "@/lib/calendar-math";
import type { MonthGridCell } from "./month-grid";
import type { DaySummary } from "./day-summary";

export function DayCell({
  cell,
  today,
  summary,
  selected,
  onSelect,
}: {
  cell: MonthGridCell;
  today: LocalDate;
  summary: DaySummary | null;
  selected?: boolean;
  onSelect: (date: LocalDate) => void;
}) {
  const isToday = compareLocalDate(cell.date, today) === 0;
  const isSelected = selected ?? false;

  return (
    <button
      type="button"
      onClick={() => onSelect(cell.date)}
      aria-pressed={isSelected}
      aria-label={`${formatLocalDate(cell.date)}${summary ? `, чистое изменение ${summary.net}` : ""}`}
      className={`flex min-h-14 flex-col items-start gap-0.5 rounded-lg border p-1 text-left ${
        cell.isCurrentMonth ? "" : "opacity-40"
      } ${isToday ? "ring-2 ring-accent-yellow" : ""} ${
        isSelected ? "border-accent-yellow font-bold" : "border-transparent"
      }`}
    >
      <span className="flex items-center gap-0.5 text-xs font-semibold">
        {cell.date.day}
        {isSelected && (
          <span aria-hidden="true" className="text-[9px]">
            ✓
          </span>
        )}
      </span>
      {summary && (
        <span className="flex flex-col gap-0.5">
          <span
            className={`text-[10px] font-medium ${summary.net >= 0 ? "text-accent-yellow" : "text-accent-red"}`}
          >
            {summary.net >= 0 ? "+" : ""}
            {summary.net}
          </span>
          <span className="flex gap-0.5" aria-hidden="true">
            {summary.hasActual && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
            {summary.hasVirtual && (
              <span className="h-1.5 w-1.5 rounded-full border border-muted bg-transparent" />
            )}
          </span>
        </span>
      )}
    </button>
  );
}
