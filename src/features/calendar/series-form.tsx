"use client";

import { useState } from "react";
import {
  CurrencyType,
  IncomeSource,
  RecurrenceEndType,
  RecurrenceFrequency,
  TransactionType,
  formatLocalDate,
  parseLocalDate,
  type LocalDate,
  type RecurringTransactionType,
} from "@/lib/calendar-math";
import { NumericField } from "@/features/calculator/numeric-field";
import { parseNonNegativeInt } from "@/features/calculator/field-validation";
import {
  CURRENCY_TYPE_LABELS,
  INCOME_SOURCE_LABELS,
  RECURRENCE_FREQUENCY_LABELS,
  WEEKDAY_SHORT_LABELS,
} from "./labels";
import type { RecurrenceRuleDto, SeriesRecordDto, SeriesTemplateDto } from "./api";

export type SeriesFormMode = "create" | "edit" | "split";

export type SeriesFormResult = { template: SeriesTemplateDto; rule: RecurrenceRuleDto };

function toFormRule(existing?: SeriesRecordDto, splitDate?: LocalDate) {
  return {
    frequency: existing?.rule.frequency ?? RecurrenceFrequency.DAILY,
    interval: existing?.rule.interval ?? 1,
    daysOfWeek: existing?.rule.daysOfWeek ?? [],
    dayOfMonth: existing?.rule.dayOfMonth ?? null,
    startDate: splitDate ? formatLocalDate(splitDate) : (existing?.rule.startDate ?? ""),
    endType: existing?.rule.endType ?? RecurrenceEndType.NEVER,
    endDate: existing?.rule.endDate ?? null,
    occurrenceCount: existing?.rule.occurrenceCount ?? null,
  };
}

export function SeriesForm({
  mode,
  existing,
  splitDate,
  submitting,
  onSubmit,
  onCancel,
}: {
  mode: SeriesFormMode;
  existing?: SeriesRecordDto;
  splitDate?: LocalDate;
  submitting: boolean;
  onSubmit: (result: SeriesFormResult) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<RecurringTransactionType>(existing?.type ?? TransactionType.INCOME);
  const [currencyType, setCurrencyType] = useState<CurrencyType | null>(
    existing?.currencyType ?? CurrencyType.POLYCHROME,
  );
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [source, setSource] = useState<IncomeSource | null>(existing?.source ?? IncomeSource.DAILY);
  const [note, setNote] = useState(existing?.note ?? "");
  const [rule, setRule] = useState(() => toFormRule(existing, splitDate));

  const amountResult = parseNonNegativeInt(amount);
  const canEditStartDate = mode === "create";

  function handleSubmit() {
    if (!amountResult.ok) return;
    onSubmit({
      template: {
        type,
        currencyType,
        amount: amountResult.value,
        source: type === TransactionType.INCOME ? source : null,
        bannerFamily: null,
        note: note.trim().length > 0 ? note.trim() : null,
      },
      rule,
    });
  }

  return (
    <div className="space-y-3">
      {mode === "split" && (
        <p className="rounded-lg border border-accent-orange/40 bg-accent-orange/10 p-3 text-xs">
          Изменения применятся начиная с {splitDate ? formatLocalDate(splitDate) : ""}. Прошлые
          записи не изменятся.
        </p>
      )}

      <fieldset className="flex gap-2" role="radiogroup" aria-label="Тип">
        {[TransactionType.INCOME, TransactionType.EXPENSE].map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t as RecurringTransactionType)}
            className={`min-h-11 flex-1 rounded-xl border text-sm font-semibold ${
              type === t ? "border-accent-yellow bg-accent-yellow text-black" : "border-border"
            }`}
          >
            {t === TransactionType.INCOME ? "Доход" : "Расход"}
          </button>
        ))}
      </fieldset>

      <div>
        <label htmlFor="series-currency" className="mb-1 block text-xs font-medium text-muted">
          Валюта
        </label>
        <select
          id="series-currency"
          value={currencyType ?? ""}
          onChange={(e) => setCurrencyType(e.target.value as CurrencyType)}
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
        id="series-amount"
        label="Количество за одно вхождение"
        value={amount}
        onChange={setAmount}
        error={!amountResult.ok ? amountResult.error : undefined}
      />

      {type === TransactionType.INCOME && (
        <div>
          <label htmlFor="series-source" className="mb-1 block text-xs font-medium text-muted">
            Источник
          </label>
          <select
            id="series-source"
            value={source ?? ""}
            onChange={(e) => setSource(e.target.value as IncomeSource)}
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
        <label htmlFor="series-frequency" className="mb-1 block text-xs font-medium text-muted">
          Периодичность
        </label>
        <select
          id="series-frequency"
          value={rule.frequency}
          onChange={(e) =>
            setRule((prev) => ({
              ...prev,
              frequency: e.target.value as RecurrenceFrequency,
              daysOfWeek: [],
              dayOfMonth: null,
            }))
          }
          className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
        >
          {Object.values(RecurrenceFrequency).map((f) => (
            <option key={f} value={f}>
              {RECURRENCE_FREQUENCY_LABELS[f]}
            </option>
          ))}
        </select>
      </div>

      {rule.frequency === RecurrenceFrequency.WEEKLY && (
        <fieldset aria-label="Дни недели" className="flex flex-wrap gap-1">
          {WEEKDAY_SHORT_LABELS.map((label, dow) => {
            const checked = rule.daysOfWeek.includes(dow);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={checked}
                onClick={() =>
                  setRule((prev) => ({
                    ...prev,
                    daysOfWeek: checked
                      ? prev.daysOfWeek.filter((d) => d !== dow)
                      : [...prev.daysOfWeek, dow],
                  }))
                }
                className={`min-h-11 min-w-11 rounded-lg border text-xs font-semibold ${
                  checked ? "border-accent-yellow bg-accent-yellow text-black" : "border-border"
                }`}
              >
                {label}
              </button>
            );
          })}
        </fieldset>
      )}

      {rule.frequency === RecurrenceFrequency.MONTHLY && (
        <NumericField
          id="series-day-of-month"
          label="День месяца (1–31)"
          value={rule.dayOfMonth !== null ? String(rule.dayOfMonth) : ""}
          onChange={(v) => setRule((prev) => ({ ...prev, dayOfMonth: v === "" ? null : Number(v) }))}
        />
      )}

      {canEditStartDate ? (
        <div>
          <label htmlFor="series-start-date" className="mb-1 block text-xs font-medium text-muted">
            Дата начала
          </label>
          <input
            id="series-start-date"
            type="date"
            value={rule.startDate}
            onChange={(e) => setRule((prev) => ({ ...prev, startDate: e.target.value }))}
            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
          />
        </div>
      ) : (
        <p className="text-xs text-muted">
          Дата начала: {rule.startDate}. Часовой пояс серии зафиксирован при создании и не
          изменяется.
        </p>
      )}

      <div>
        <label htmlFor="series-end-type" className="mb-1 block text-xs font-medium text-muted">
          Окончание
        </label>
        <select
          id="series-end-type"
          value={rule.endType}
          onChange={(e) =>
            setRule((prev) => ({
              ...prev,
              endType: e.target.value as RecurrenceEndType,
              endDate: null,
              occurrenceCount: null,
            }))
          }
          className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
        >
          <option value={RecurrenceEndType.NEVER}>Никогда</option>
          <option value={RecurrenceEndType.UNTIL_DATE}>До даты</option>
          <option value={RecurrenceEndType.AFTER_COUNT}>После N повторений</option>
        </select>
      </div>

      {rule.endType === RecurrenceEndType.UNTIL_DATE && (
        <input
          type="date"
          aria-label="Дата окончания"
          value={rule.endDate ?? ""}
          onChange={(e) => setRule((prev) => ({ ...prev, endDate: e.target.value }))}
          className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
        />
      )}
      {rule.endType === RecurrenceEndType.AFTER_COUNT && (
        <NumericField
          id="series-occurrence-count"
          label="Количество повторений"
          value={rule.occurrenceCount !== null ? String(rule.occurrenceCount) : ""}
          onChange={(v) => setRule((prev) => ({ ...prev, occurrenceCount: v === "" ? null : Number(v) }))}
        />
      )}

      <div>
        <label htmlFor="series-note" className="mb-1 block text-xs font-medium text-muted">
          Заметка
        </label>
        <input
          id="series-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
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
          disabled={submitting || !amountResult.ok || rule.startDate === ""}
          className="min-h-11 flex-1 rounded-xl bg-accent-yellow text-sm font-bold text-black disabled:opacity-40"
        >
          {submitting ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

/** Small helper so callers don't need to import parseLocalDate themselves for the split flow. */
export function parseFormLocalDate(value: string): LocalDate {
  return parseLocalDate(value);
}
