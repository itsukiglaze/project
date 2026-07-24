"use client";

import { useState } from "react";
import { BannerFamily } from "@/config/gacha";
import { CurrencyType, IncomeSource, TransactionType, formatLocalDate, type LocalDate } from "@/lib/calendar-math";
import { NumericField } from "@/features/calculator/numeric-field";
import { parseNonNegativeInt } from "@/features/calculator/field-validation";
import { CURRENCY_TYPE_LABELS, INCOME_SOURCE_LABELS, TRANSACTION_TYPE_LABELS } from "./labels";
import type { TransactionInputDto, TransactionRecordDto } from "./api";

export type TransactionFormValues = {
  type: TransactionType;
  currencyType: CurrencyType | null;
  amount: string;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string;
};

export type EditableTransaction = Omit<TransactionRecordDto, "timezone">;

function defaultValues(existing?: EditableTransaction): TransactionFormValues {
  if (!existing) {
    return {
      type: TransactionType.INCOME,
      currencyType: CurrencyType.POLYCHROME,
      amount: "",
      source: IncomeSource.DAILY,
      bannerFamily: null,
      note: "",
    };
  }
  return {
    type: existing.type,
    currencyType: existing.currencyType,
    amount: String(existing.amount),
    source: existing.source,
    bannerFamily: existing.bannerFamily,
    note: existing.note ?? "",
  };
}

export function TransactionForm({
  date,
  timezone,
  existing,
  onSubmit,
  onCancel,
  submitting,
}: {
  date: LocalDate;
  timezone: string;
  existing?: EditableTransaction;
  onSubmit: (input: TransactionInputDto) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [values, setValues] = useState<TransactionFormValues>(() => defaultValues(existing));
  const amountResult = parseNonNegativeInt(values.amount);
  const amountError = !amountResult.ok ? amountResult.error : undefined;

  const isMaterialized = Boolean(existing?.seriesId);

  function handleSubmit() {
    if (!amountResult.ok) return;
    onSubmit({
      localDate: formatLocalDate(date),
      type: values.type,
      currencyType: values.currencyType,
      amount: amountResult.value,
      source: values.type === TransactionType.INCOME ? values.source : null,
      bannerFamily: values.type === TransactionType.PULL ? values.bannerFamily : null,
      note: values.note.trim().length > 0 ? values.note.trim() : null,
      timezone,
    });
  }

  if (isMaterialized) {
    return (
      <p className="rounded-lg border border-border bg-surface p-3 text-xs text-muted">
        Эта запись создана из повторяющейся серии — измените или отмените конкретное вхождение в
        разделе серии, а не как обычную разовую транзакцию.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <fieldset className="flex gap-2" role="radiogroup" aria-label="Тип операции">
        {(Object.values(TransactionType) as TransactionType[]).map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={values.type === type}
            onClick={() => setValues((prev) => ({ ...prev, type }))}
            className={`min-h-11 flex-1 rounded-xl border text-sm font-semibold ${
              values.type === type ? "border-accent-yellow bg-accent-yellow text-black" : "border-border"
            }`}
          >
            {TRANSACTION_TYPE_LABELS[type]}
          </button>
        ))}
      </fieldset>

      <div>
        <label htmlFor="tx-currency" className="mb-1 block text-xs font-medium text-muted">
          Валюта
        </label>
        <select
          id="tx-currency"
          value={values.currencyType ?? ""}
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
        id="tx-amount"
        label="Количество"
        value={values.amount}
        onChange={(v) => setValues((prev) => ({ ...prev, amount: v }))}
        error={amountError}
      />

      {values.type === TransactionType.INCOME && (
        <div>
          <label htmlFor="tx-source" className="mb-1 block text-xs font-medium text-muted">
            Источник дохода
          </label>
          <select
            id="tx-source"
            value={values.source ?? ""}
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

      {values.type === TransactionType.PULL && (
        <div>
          <label htmlFor="tx-banner" className="mb-1 block text-xs font-medium text-muted">
            Баннер
          </label>
          <select
            id="tx-banner"
            value={values.bannerFamily ?? ""}
            onChange={(e) => setValues((prev) => ({ ...prev, bannerFamily: e.target.value as BannerFamily }))}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
          >
            {Object.values(BannerFamily).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="tx-note" className="mb-1 block text-xs font-medium text-muted">
          Заметка
        </label>
        <input
          id="tx-note"
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
