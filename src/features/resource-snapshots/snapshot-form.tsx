"use client";

import { useState } from "react";
import { CurrencyType, formatLocalDate, parseLocalDate, type LocalDate } from "@/lib/calendar-math";
import { NumericField } from "@/features/calculator/numeric-field";
import { isEmptyField, parseNonNegativeInt, type FieldParseResult } from "@/features/calculator/field-validation";
import { SNAPSHOT_CURRENCY_ORDER, CURRENCY_TYPE_LABELS } from "./labels";
import type { ResourceSnapshotItemDto } from "./api";

export type SnapshotFormResult = {
  localDate: LocalDate;
  note: string | null;
  items: ResourceSnapshotItemDto[];
};

type ParsedField = { currency: CurrencyType; raw: string; result: FieldParseResult | null };

function prefillValues(items: ResourceSnapshotItemDto[]): Record<CurrencyType, string> {
  const byCurrency = new Map(items.map((item) => [item.currencyType, item.amount]));
  const values = {} as Record<CurrencyType, string>;
  for (const currency of SNAPSHOT_CURRENCY_ORDER) {
    const amount = byCurrency.get(currency);
    values[currency] = amount !== undefined ? String(amount) : "";
  }
  return values;
}

/**
 * Prefilled from the latest known values (or, when editing a specific past
 * date, that date's own stored values) so the user only has to retype
 * whatever actually changed. A field left BLANK means "not tracked in this
 * snapshot" — it is dropped from what's submitted, never coerced to 0 (see
 * resource-snapshot-repository.ts's full-replace upsert for what that
 * means server-side).
 */
export function SnapshotForm({
  today,
  prefillItems,
  existingDate,
  existingNote,
  submitting,
  onSubmit,
  onCancel,
}: {
  today: LocalDate;
  prefillItems: ResourceSnapshotItemDto[];
  existingDate?: LocalDate;
  existingNote?: string | null;
  submitting: boolean;
  onSubmit: (result: SnapshotFormResult) => void;
  onCancel: () => void;
}) {
  const [dateValue, setDateValue] = useState(formatLocalDate(existingDate ?? today));
  const [note, setNote] = useState(existingNote ?? "");
  const [values, setValues] = useState<Record<CurrencyType, string>>(() => prefillValues(prefillItems));

  const parsedFields: ParsedField[] = SNAPSHOT_CURRENCY_ORDER.map((currency) => ({
    currency,
    raw: values[currency],
    result: isEmptyField(values[currency]) ? null : parseNonNegativeInt(values[currency]),
  }));
  const hasError = parsedFields.some((field) => field.result !== null && !field.result.ok);
  const hasAnyValue = parsedFields.some((field) => field.result !== null && field.result.ok);

  let parsedDate: LocalDate | null;
  try {
    parsedDate = parseLocalDate(dateValue);
  } catch {
    parsedDate = null;
  }

  const canSubmit = !hasError && hasAnyValue && parsedDate !== null;

  function handleSubmit() {
    if (!canSubmit || !parsedDate) return;
    const items: ResourceSnapshotItemDto[] = parsedFields
      .filter((field): field is ParsedField & { result: { ok: true; value: number } } =>
        field.result !== null && field.result.ok,
      )
      .map((field) => ({ currencyType: field.currency, amount: field.result.value }));
    onSubmit({ localDate: parsedDate, note: note.trim().length > 0 ? note.trim() : null, items });
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="snapshot-date" className="mb-1 block text-xs font-medium text-muted">
          Дата
        </label>
        <input
          id="snapshot-date"
          type="date"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
        />
      </div>

      {parsedFields.map((field) => (
        <NumericField
          key={field.currency}
          id={`snapshot-${field.currency}`}
          label={CURRENCY_TYPE_LABELS[field.currency]}
          value={field.raw}
          onChange={(value) => setValues((prev) => ({ ...prev, [field.currency]: value }))}
          placeholder="Не отслеживается"
          error={field.result && !field.result.ok ? field.result.error : undefined}
        />
      ))}
      <p className="text-xs text-muted">
        Оставьте поле пустым, если не отслеживаете эту валюту — прежнее значение не будет затронуто.
      </p>

      <div>
        <label htmlFor="snapshot-note" className="mb-1 block text-xs font-medium text-muted">
          Заметка
        </label>
        <input
          id="snapshot-note"
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
          disabled={submitting || !canSubmit}
          className="min-h-11 flex-1 rounded-xl bg-accent-yellow text-sm font-bold text-black disabled:opacity-40"
        >
          {submitting ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
