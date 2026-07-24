"use client";

import type { FieldChange } from "@/lib/diff";

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "да" : "нет";
  return String(value);
}

export function DiffPreview<T extends Record<string, unknown>>({
  changes,
  labels,
  onConfirm,
  onCancel,
  confirming,
}: {
  changes: FieldChange<T>[];
  labels: Record<keyof T, string>;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-accent-yellow/50 bg-surface p-4">
      <h2 className="text-sm font-bold">Будет изменено</h2>

      {changes.length === 0 ? (
        <p className="text-xs text-muted">Изменений нет.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {changes.map((change) => (
            <li key={String(change.field)} className="flex items-baseline justify-between gap-2">
              <span className="text-muted">{labels[change.field]}</span>
              <span className="font-semibold">
                {formatValue(change.previous)} → {formatValue(change.next)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="min-h-11 flex-1 rounded-xl border border-border text-sm font-semibold disabled:opacity-40"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming || changes.length === 0}
          className="min-h-11 flex-1 rounded-xl bg-accent-yellow text-sm font-bold text-black disabled:opacity-40"
        >
          {confirming ? "Сохраняем…" : "Подтвердить"}
        </button>
      </div>
    </section>
  );
}
