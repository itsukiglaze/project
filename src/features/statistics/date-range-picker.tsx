"use client";

import { useState } from "react";
import {
  addDays,
  compareLocalDate,
  daysInMonth,
  formatLocalDate,
  parseLocalDate,
  toEpochDay,
  type LocalDate,
} from "@/lib/calendar-math";
import { getTodayLocalDate } from "@/features/calendar/local-date-client";

/** Same bound as the API's statisticsOverviewQuerySchema — kept in sync manually, both set to 366. */
const MAX_RANGE_DAYS = 366;

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: LocalDate;
  to: LocalDate;
  onChange: (from: LocalDate, to: LocalDate) => void;
}) {
  const today = getTodayLocalDate();
  const [customFrom, setCustomFrom] = useState(formatLocalDate(from));
  const [customTo, setCustomTo] = useState(formatLocalDate(to));
  const [rangeError, setRangeError] = useState<string | null>(null);

  function applyRange(newFrom: LocalDate, newTo: LocalDate) {
    setCustomFrom(formatLocalDate(newFrom));
    setCustomTo(formatLocalDate(newTo));
    setRangeError(null);
    onChange(newFrom, newTo);
  }

  function applySymmetricPreset(days: number) {
    applyRange(addDays(today, -days), addDays(today, days));
  }

  function applyThisMonth() {
    applyRange(
      { year: today.year, month: today.month, day: 1 },
      { year: today.year, month: today.month, day: daysInMonth(today.year, today.month) },
    );
  }

  function applyCustomRange() {
    let parsedFrom: LocalDate;
    let parsedTo: LocalDate;
    try {
      parsedFrom = parseLocalDate(customFrom);
      parsedTo = parseLocalDate(customTo);
    } catch {
      setRangeError("Некорректная дата.");
      return;
    }
    if (compareLocalDate(parsedFrom, parsedTo) > 0) {
      setRangeError("Начальная дата должна быть раньше конечной или равна ей.");
      return;
    }
    if (toEpochDay(parsedTo) - toEpochDay(parsedFrom) > MAX_RANGE_DAYS) {
      setRangeError(`Диапазон не может превышать ${MAX_RANGE_DAYS} дней.`);
      return;
    }
    setRangeError(null);
    onChange(parsedFrom, parsedTo);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Быстрый выбор периода">
        <button
          type="button"
          onClick={() => applySymmetricPreset(7)}
          className="min-h-11 rounded-full border border-border px-3 text-xs font-semibold"
        >
          ±7 дней
        </button>
        <button
          type="button"
          onClick={() => applySymmetricPreset(30)}
          className="min-h-11 rounded-full border border-border px-3 text-xs font-semibold"
        >
          ±30 дней
        </button>
        <button
          type="button"
          onClick={() => applySymmetricPreset(90)}
          className="min-h-11 rounded-full border border-border px-3 text-xs font-semibold"
        >
          ±90 дней
        </button>
        <button
          type="button"
          onClick={applyThisMonth}
          className="min-h-11 rounded-full border border-border px-3 text-xs font-semibold"
        >
          Этот месяц
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="stats-range-from" className="mb-1 block text-xs font-medium text-muted">
            С
          </label>
          <input
            id="stats-range-from"
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="stats-range-to" className="mb-1 block text-xs font-medium text-muted">
            По
          </label>
          <input
            id="stats-range-to"
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={applyCustomRange}
        className="min-h-11 w-full rounded-xl bg-accent-yellow text-sm font-bold text-black"
      >
        Применить период
      </button>

      {rangeError && (
        <p role="alert" className="text-xs text-accent-red">
          {rangeError}
        </p>
      )}
    </div>
  );
}
