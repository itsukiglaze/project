"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_LABELS } from "./labels";
import type { YearMonth } from "./month-grid";

export function MonthNavigation({
  yearMonth,
  onPrev,
  onNext,
  onToday,
}: {
  yearMonth: YearMonth;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Предыдущий месяц"
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex flex-col items-center">
        <h1 className="text-base font-bold">
          {MONTH_LABELS[yearMonth.month - 1]} {yearMonth.year}
        </h1>
        <button
          type="button"
          onClick={onToday}
          className="min-h-8 rounded-full bg-accent-yellow px-3 text-xs font-semibold text-black"
        >
          Сегодня
        </button>
      </div>

      <button
        type="button"
        onClick={onNext}
        aria-label="Следующий месяц"
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
