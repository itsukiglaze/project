"use client";

import { CURRENCY_TYPE_LABELS, INCOME_SOURCE_LABELS } from "@/features/calendar/labels";
import type { BannerPullCountDto, SourceCurrencyAmountDto } from "./api";

function SourceBreakdown({ items }: { items: SourceCurrencyAmountDto[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted">Нет фактического дохода за этот период.</p>;
  }
  const max = Math.max(...items.map((i) => i.amount), 1);
  return (
    <table className="w-full text-xs">
      <caption className="sr-only">Фактический доход по источнику и валюте</caption>
      <thead>
        <tr>
          <th scope="col" className="text-left font-medium text-muted">
            Источник
          </th>
          <th scope="col" className="text-left font-medium text-muted">
            Валюта
          </th>
          <th scope="col" className="w-1/2 font-medium text-muted" />
          <th scope="col" className="text-right font-medium text-muted">
            Сумма
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={`${item.source}:${item.currency}`}>
            <td>{INCOME_SOURCE_LABELS[item.source]}</td>
            <td>{CURRENCY_TYPE_LABELS[item.currency]}</td>
            <td>
              <div className="h-2 rounded-full bg-border">
                <div
                  className="h-2 rounded-full bg-accent-yellow"
                  style={{ width: `${(item.amount / max) * 100}%` }}
                />
              </div>
            </td>
            <td className="text-right font-semibold">{item.amount.toLocaleString("ru-RU")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BannerFamilyBreakdown({ items }: { items: BannerPullCountDto[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted">Нет фактических круток за этот период.</p>;
  }
  const max = Math.max(...items.map((i) => i.pulls), 1);
  return (
    <table className="w-full text-xs">
      <caption className="sr-only">Фактические крутки по баннеру</caption>
      <thead>
        <tr>
          <th scope="col" className="text-left font-medium text-muted">
            Баннер
          </th>
          <th scope="col" className="text-left font-medium text-muted">
            Валюта
          </th>
          <th scope="col" className="w-1/2 font-medium text-muted" />
          <th scope="col" className="text-right font-medium text-muted">
            Круток
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.bannerFamily}>
            <td>{item.bannerFamily}</td>
            <td>{CURRENCY_TYPE_LABELS[item.currency]}</td>
            <td>
              <div className="h-2 rounded-full bg-border">
                <div className="h-2 rounded-full bg-accent-yellow" style={{ width: `${(item.pulls / max) * 100}%` }} />
              </div>
            </td>
            <td className="text-right font-semibold">{item.pulls}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Real, logged history only — grouped by source and by banner family. Both
 * tables ARE the accessible alternative to a chart (not a chart with a
 * separate table view): each row already carries its own small inline bar
 * alongside the exact number, so a screen reader or a user who can't read
 * the bar gets the same information either way.
 */
export function TransactionTrendsPanel({
  bySource,
  byBannerFamily,
}: {
  bySource: SourceCurrencyAmountDto[];
  byBannerFamily: BannerPullCountDto[];
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">Тренды операций (факт)</h2>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-muted">По источнику дохода</h3>
        <SourceBreakdown items={bySource} />
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-muted">По баннеру</h3>
        <BannerFamilyBreakdown items={byBannerFamily} />
      </div>
    </section>
  );
}
