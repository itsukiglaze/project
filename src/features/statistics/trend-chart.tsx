"use client";

import { useState } from "react";
import type { StatisticsTimelinePointDto } from "./api";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 120;

type Point = { x: number; y: number };

function buildPath(points: Array<Point | null>): string {
  let path = "";
  let started = false;
  for (const point of points) {
    if (point === null) {
      started = false;
      continue;
    }
    path += started ? ` L ${point.x} ${point.y}` : `M ${point.x} ${point.y}`;
    started = true;
  }
  return path;
}

/**
 * The continuous actual-to-projected Polychrome net-flow trajectory:
 * solid for the actual (through today) portion, dashed for the scheduled
 * continuation — a single line, not two independently-anchored series
 * (the underlying data already guarantees they meet exactly at today; see
 * statistics-math/timeline.ts). This is a RELATIVE net change over the
 * period, not the user's real wallet balance, and pull activity is never
 * folded into it — see the caption text below the chart.
 */
export function TrendChart({ timeline }: { timeline: StatisticsTimelinePointDto[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");

  if (timeline.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">Изменение баланса (Полихромы)</h2>
        <p className="text-xs text-muted">Нет данных за этот период.</p>
      </section>
    );
  }

  const totalPulls = timeline.reduce((sum, p) => sum + p.actualPulls + p.scheduledPulls, 0);

  const allValues = timeline.flatMap((p) =>
    [p.actualCumulativeNetPolychrome, p.projectedCumulativeNetPolychrome].filter(
      (v): v is number => v !== null,
    ),
  );
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(0, ...allValues);
  const valueRange = maxValue - minValue || 1;

  function toXY(index: number, value: number): Point {
    const x = (index / Math.max(timeline.length - 1, 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - ((value - minValue) / valueRange) * CHART_HEIGHT;
    return { x, y };
  }

  const actualPoints = timeline.map((p, i) =>
    p.actualCumulativeNetPolychrome === null ? null : toXY(i, p.actualCumulativeNetPolychrome),
  );
  const projectedPoints = timeline.map((p, i) =>
    p.projectedCumulativeNetPolychrome === null ? null : toXY(i, p.projectedCumulativeNetPolychrome),
  );
  const zeroY = toXY(0, 0).y;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Изменение баланса (Полихромы)</h2>
        <button
          type="button"
          onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
          className="min-h-11 rounded-full border border-border px-3 text-xs font-semibold"
        >
          {view === "chart" ? "Показать таблицей" : "Показать графиком"}
        </button>
      </div>
      <p className="text-xs text-muted">
        Относительное изменение за период, не ваш реальный баланс кошелька в Настройках. Сплошная линия
        — факт по сегодня, пунктир — запланировано дальше.
      </p>

      {view === "chart" ? (
        <svg
          role="img"
          aria-label="График изменения баланса Полихром: сплошная линия — факт по сегодня, пунктирная — запланировано дальше"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-32 w-full"
        >
          <line x1={0} y1={zeroY} x2={CHART_WIDTH} y2={zeroY} stroke="currentColor" strokeOpacity={0.2} />
          <path d={buildPath(actualPoints)} fill="none" stroke="currentColor" strokeWidth={2} />
          <path
            d={buildPath(projectedPoints)}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        </svg>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Изменение баланса Полихром по дням: факт и прогноз, накопительно</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left font-medium text-muted">
                  День
                </th>
                <th scope="col" className="text-right font-medium text-muted">
                  Факт (накоп.)
                </th>
                <th scope="col" className="text-right font-medium text-muted">
                  Прогноз (накоп.)
                </th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td className="text-right">{point.actualCumulativeNetPolychrome ?? "—"}</td>
                  <td className="text-right">{point.projectedCumulativeNetPolychrome ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPulls > 0 && (
        <p className="text-xs text-muted">
          Круток за период: {totalPulls} (не отражены на этом графике — см. «Итоги за период»).
        </p>
      )}
    </section>
  );
}
