"use client";

import { formatLocalDate, type LocalDate } from "@/lib/calendar-math";
import { DayCell } from "./day-cell";
import { WEEKDAY_SHORT_LABELS } from "./labels";
import type { MonthGridCell } from "./month-grid";
import type { DaySummary } from "./day-summary";

export function MonthGridView({
  weeks,
  today,
  selectedDate,
  summaries,
  onSelectDay,
}: {
  weeks: MonthGridCell[][];
  today: LocalDate;
  selectedDate?: LocalDate | null;
  summaries: Map<string, DaySummary>;
  onSelectDay: (date: LocalDate) => void;
}) {
  const selectedKey = selectedDate ? formatLocalDate(selectedDate) : null;

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px] font-semibold text-muted">
        {WEEKDAY_SHORT_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((cell) => {
          const dateKey = formatLocalDate(cell.date);
          return (
            <DayCell
              key={dateKey}
              cell={cell}
              today={today}
              selected={dateKey === selectedKey}
              summary={summaries.get(dateKey) ?? null}
              onSelect={onSelectDay}
            />
          );
        })}
      </div>
    </div>
  );
}
