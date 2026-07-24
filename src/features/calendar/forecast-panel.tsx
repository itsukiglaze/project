"use client";

import { useForecastQuery } from "./use-calendar-queries";

const FORECAST_HORIZON_DAYS = 30;

export function ForecastPanel() {
  const query = useForecastQuery(FORECAST_HORIZON_DAYS);

  if (query.status === "loading") {
    return <div className="animate-pulse rounded-2xl bg-border p-4" style={{ height: 96 }} />;
  }

  if (query.status === "error") {
    return (
      <section role="alert" className="rounded-2xl border border-accent-red/40 bg-accent-red/5 p-4 text-sm">
        Не удалось загрузить прогноз.
      </section>
    );
  }

  const { data } = query;

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Прогноз на {data.effectiveHorizonDays} дней</h2>
        <span className="rounded-full bg-accent-yellow px-2 py-0.5 text-[10px] font-bold text-black">
          Оценка
        </span>
      </div>
      <p className="text-xs text-muted">
        Это оценка на основе активных повторяющихся серий, а не гарантия фактического поступления.
      </p>
      <p className="text-2xl font-bold">{data.projectedEndingBalance}</p>
      <p className="text-xs text-muted">Ожидаемый баланс к {data.rangeEnd}</p>
    </section>
  );
}
