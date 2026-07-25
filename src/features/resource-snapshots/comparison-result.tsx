"use client";

import { parseLocalDate } from "@/lib/calendar-math";
import { formatHumanDate } from "@/features/calendar/date-format";
import { daysBetweenLocalDates } from "@/lib/resource-snapshot-math/comparison";
import { ComparisonRow } from "./comparison-row";
import { daysAgoLabel } from "./labels";
import type { ResourceSnapshotComparisonDto } from "./api";

/** The after-save (or latest-snapshot) comparison card: "Изменение с <date>" + per-currency rows. */
export function SnapshotComparisonResult({ snapshot }: { snapshot: ResourceSnapshotComparisonDto }) {
  const hasPrevious = snapshot.previousLocalDate !== null;
  const gapDays = hasPrevious
    ? daysBetweenLocalDates(parseLocalDate(snapshot.previousLocalDate as string), parseLocalDate(snapshot.record.localDate))
    : null;

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">
        {hasPrevious
          ? `Изменение с ${formatHumanDate(parseLocalDate(snapshot.previousLocalDate as string))}`
          : "Первое сохранение"}
      </h2>
      {!hasPrevious && (
        <p className="text-xs text-muted">Первое сохранение — сравнивать пока не с чем.</p>
      )}
      <div className="space-y-1">
        {snapshot.comparison.map((comparison) => (
          <ComparisonRow key={comparison.currencyType} comparison={comparison} />
        ))}
      </div>
      {gapDays !== null && <p className="text-xs text-muted">{daysAgoLabel(gapDays)}</p>}
    </section>
  );
}
