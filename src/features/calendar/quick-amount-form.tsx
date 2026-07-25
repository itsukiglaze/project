"use client";

import { useState } from "react";
import { CurrencyType, IncomeSource, TransactionType, formatLocalDate, type LocalDate } from "@/lib/calendar-math";
import { NumericField } from "@/features/calculator/numeric-field";
import { parseNonNegativeInt } from "@/features/calculator/field-validation";
import { CURRENCY_TYPE_LABELS, INCOME_SOURCE_LABELS } from "./labels";
import type { TransactionInputDto } from "./api";

type Direction = "RECEIVED" | "SPENT";

export type QuickAmountFormValues = {
  direction: Direction;
  currencyType: CurrencyType;
  amount: string;
  source: IncomeSource;
  note: string;
};

/**
 * "+ Добавить сумму" — a compact one-time-transaction entry, distinct from
 * "+ Добавить источник" (a recurring source). Builds the exact same
 * TransactionInputDto the day-detail sheet's fuller TransactionForm does
 * (same CalendarTransaction infrastructure, same validation) — just a
 * simpler direction toggle ("Получено"/"Потрачено" instead of Доход/
 * Расход/Крутка) and no PULL/banner-family option, since this entry point
 * is for a quick income/expense amount, not a gacha pull record.
 */
export function QuickAmountForm({
  date,
  timezone,
  submitting,
  onSubmit,
  onCancel,
}: {
  date: LocalDate;
  timezone: string;
  submitting: boolean;
  onSubmit: (input: TransactionInputDto) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<QuickAmountFormValues>({
    direction: "RECEIVED",
    currencyType: CurrencyType.POLYCHROME,
    amount: "",
    source: IncomeSource.OTHER,
    note: "",
  });
  const amountResult = parseNonNegativeInt(values.amount);

  function handleSubmit() {
    if (!amountResult.ok) return;
    onSubmit({
      localDate: formatLocalDate(date),
      type: values.direction === "RECEIVED" ? TransactionType.INCOME : TransactionType.EXPENSE,
      currencyType: values.currencyType,
      amount: amountResult.value,
      source: values.direction === "RECEIVED" ? values.source : null,
      bannerFamily: null,
      note: values.note.trim().length > 0 ? values.note.trim() : null,
      timezone,
    });
  }

  return (
    <div className="space-y-3">
      <fieldset className="flex gap-2" role="radiogroup" aria-label="Направление">
        {(["RECEIVED", "SPENT"] as const).map((direction) => (
          <button
            key={direction}
            type="button"
            role="radio"
            aria-checked={values.direction === direction}
            onClick={() => setValues((prev) => ({ ...prev, direction }))}
            className={`min-h-11 flex-1 rounded-xl border text-sm font-semibold ${
              values.direction === direction ? "border-accent-yellow bg-accent-yellow text-black" : "border-border"
            }`}
          >
            {direction === "RECEIVED" ? "Получено" : "Потрачено"}
          </button>
        ))}
      </fieldset>

      <div>
        <label htmlFor="quick-currency" className="mb-1 block text-xs font-medium text-muted">
          Ресурс
        </label>
        <select
          id="quick-currency"
          value={values.currencyType}
          onChange={(e) => setValues((prev) => ({ ...prev, currencyType: e.target.value as CurrencyType }))}
          className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
        >
          {Object.values(CurrencyType).map((c) => (
            <option key={c} value={c}>
              {CURRENCY_TYPE_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <NumericField
        id="quick-amount"
        label="Количество"
        value={values.amount}
        onChange={(v) => setValues((prev) => ({ ...prev, amount: v }))}
        error={!amountResult.ok ? amountResult.error : undefined}
      />

      {values.direction === "RECEIVED" && (
        <div>
          <label htmlFor="quick-source" className="mb-1 block text-xs font-medium text-muted">
            Источник
          </label>
          <select
            id="quick-source"
            value={values.source}
            onChange={(e) => setValues((prev) => ({ ...prev, source: e.target.value as IncomeSource }))}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
          >
            {Object.values(IncomeSource).map((s) => (
              <option key={s} value={s}>
                {INCOME_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="quick-note" className="mb-1 block text-xs font-medium text-muted">
          Заметка (необязательно)
        </label>
        <input
          id="quick-note"
          type="text"
          value={values.note}
          onChange={(e) => setValues((prev) => ({ ...prev, note: e.target.value }))}
          maxLength={500}
          className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 flex-1 rounded-xl border border-border text-sm font-semibold"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !amountResult.ok}
          className="min-h-11 flex-1 rounded-xl bg-accent-yellow text-sm font-bold text-black disabled:opacity-40"
        >
          {submitting ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
