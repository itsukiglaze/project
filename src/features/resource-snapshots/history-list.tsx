"use client";

import { parseLocalDate } from "@/lib/calendar-math";
import { formatHumanDate } from "@/features/calendar/date-format";
import { ComparisonRow } from "./comparison-row";
import { daysAgoLabel } from "./labels";
import { daysBetweenLocalDates } from "@/lib/resource-snapshot-math/comparison";
import type { ResourceSnapshotComparisonDto } from "./api";

/** Chronological (newest-first) list — a compact table is sufficient for the first implementation, per spec; no chart. */
export function HistoryList({
  snapshots,
  onEdit,
  onDelete,
}: {
  snapshots: ResourceSnapshotComparisonDto[];
  onEdit: (snapshot: ResourceSnapshotComparisonDto) => void;
  onDelete: (snapshot: ResourceSnapshotComparisonDto) => void;
}) {
  if (snapshots.length === 0) {
    return <p className="text-xs text-muted">Сохранённых балансов пока нет.</p>;
  }

  const newestFirst = [...snapshots].reverse();

  return (
    <ul className="space-y-2">
      {newestFirst.map((snapshot) => {
        const hasPrevious = snapshot.previousLocalDate !== null;
        const gapDays = hasPrevious
          ? daysBetweenLocalDates(
              parseLocalDate(snapshot.previousLocalDate as string),
              parseLocalDate(snapshot.record.localDate),
            )
          : null;

        return (
          <li key={snapshot.record.localDate} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{formatHumanDate(parseLocalDate(snapshot.record.localDate), true)}</p>
              {gapDays !== null && <p className="text-xs text-muted">{daysAgoLabel(gapDays)}</p>}
            </div>

            <div className="space-y-1">
              {snapshot.comparison.map((comparison) => (
                <ComparisonRow key={comparison.currencyType} comparison={comparison} />
              ))}
            </div>

            {snapshot.record.note && <p className="text-xs italic text-muted">{snapshot.record.note}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(snapshot)}
                aria-label={`Изменить баланс за ${formatHumanDate(parseLocalDate(snapshot.record.localDate), true)}`}
                className="min-h-11 flex-1 rounded-lg border border-border px-3 text-xs font-semibold"
              >
                Изменить
              </button>
              <button
                type="button"
                onClick={() => onDelete(snapshot)}
                aria-label={`Удалить баланс за ${formatHumanDate(parseLocalDate(snapshot.record.localDate), true)}`}
                className="min-h-11 flex-1 rounded-lg border border-accent-red/40 px-3 text-xs font-semibold text-accent-red"
              >
                Удалить
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
