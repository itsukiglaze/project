"use client";

import { CURRENCY_TYPE_LABELS, formatDelta } from "./labels";
import type { CurrencyComparisonDto } from "./api";

/**
 * One currency's current amount + its delta since the previous snapshot.
 * The +/− sign and ▲/▼ glyphs are explicit text, never colour alone —
 * colour is only ever a secondary reinforcement here.
 */
export function ComparisonRow({ comparison }: { comparison: CurrencyComparisonDto }) {
  const label = CURRENCY_TYPE_LABELS[comparison.currencyType];

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-semibold">{comparison.current.toLocaleString("ru-RU")}</span>
        {comparison.status === "no_previous_snapshot" && (
          <span className="text-xs text-muted">Первое сохранение</span>
        )}
        {comparison.status === "previous_value_unavailable" && (
          <span className="text-xs text-muted">Раньше не отслеживалось</span>
        )}
        {comparison.status === "positive" && (
          <span className="text-xs font-bold text-accent-yellow">
            <span aria-hidden="true">▲ </span>
            {formatDelta(comparison.delta)}
          </span>
        )}
        {comparison.status === "negative" && (
          <span className="text-xs font-bold text-accent-red">
            <span aria-hidden="true">▼ </span>
            {formatDelta(comparison.delta)}
          </span>
        )}
        {comparison.status === "unchanged" && <span className="text-xs text-muted">Без изменений</span>}
      </span>
    </div>
  );
}
