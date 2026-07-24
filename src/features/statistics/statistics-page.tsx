"use client";

import { useMemo, useState } from "react";
import { addDays } from "@/lib/calendar-math";
import { getTodayLocalDate } from "@/features/calendar/local-date-client";
import { DateRangePicker } from "./date-range-picker";
import { ResourceBalancePanel } from "./resource-balance-panel";
import { BannerPityPanel } from "./banner-pity-panel";
import { TotalsPanel } from "./totals-panel";
import { TrendChart } from "./trend-chart";
import { TransactionTrendsPanel } from "./transaction-trends-panel";
import { useStatisticsOverviewQuery } from "./use-statistics-overview-query";

const DEFAULT_RANGE_DAYS = 30;

export function StatisticsPage() {
  const today = useMemo(() => getTodayLocalDate(), []);
  const [range, setRange] = useState(() => ({
    from: addDays(today, -DEFAULT_RANGE_DAYS),
    to: addDays(today, DEFAULT_RANGE_DAYS),
  }));
  const overviewQuery = useStatisticsOverviewQuery(range.from, range.to);

  return (
    <div className="space-y-4 p-4 pt-6">
      <h1 className="text-base font-bold">Статистика</h1>

      <DateRangePicker from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />

      <ResourceBalancePanel />
      <BannerPityPanel />

      {overviewQuery.status === "loading" && (
        <div className="animate-pulse rounded-2xl bg-border" style={{ height: 280 }} />
      )}

      {overviewQuery.status === "error" && (
        <section role="alert" className="rounded-2xl border border-accent-red/40 bg-accent-red/5 p-4 text-sm">
          Не удалось загрузить статистику за этот период.
          <button
            type="button"
            onClick={overviewQuery.refetch}
            className="mt-2 block min-h-11 w-full rounded-xl bg-surface-contrast text-sm font-semibold text-background"
          >
            Повторить
          </button>
        </section>
      )}

      {overviewQuery.status === "success" && overviewQuery.data.timeline.length === 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          За выбранный период нет ни фактических, ни запланированных операций.
        </section>
      )}

      {overviewQuery.status === "success" && (
        <>
          <TotalsPanel overview={overviewQuery.data} />
          <TrendChart timeline={overviewQuery.data.timeline} />
          <TransactionTrendsPanel
            bySource={overviewQuery.data.breakdowns.bySource}
            byBannerFamily={overviewQuery.data.breakdowns.byBannerFamily}
          />
        </>
      )}

      <section className="space-y-1 rounded-2xl border border-border bg-surface p-4 text-xs text-muted">
        <h2 className="text-xs font-bold text-foreground">Что означает эта статистика</h2>
        <p>
          «Изменение баланса» — это чистый поток по операциям, записанным в Календаре, а не ваш реальный
          баланс кошелька из Настроек: между ними нет автоматической сверки.
        </p>
        <p>
          Прошлые прогнозы нигде не сохраняются, поэтому ретроспективная точность прогноза
          («насколько точным был прогноз две недели назад») недоступна — показаны только факт по
          сегодня и текущий прогноз дальше, оба посчитанные заново по актуальным данным.
        </p>
        <p>История отдельных круток и цели пока не реализованы как рабочая функциональность.</p>
      </section>
    </div>
  );
}
