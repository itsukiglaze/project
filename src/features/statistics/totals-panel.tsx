"use client";

import { useState } from "react";
import { CURRENCY_TYPE_LABELS } from "@/features/calendar/labels";
import type { BannerPullCountDto, CurrencyAmountDto, StatisticsOverviewDto } from "./api";

type View = "chart" | "table";

function CurrencyBarList({ items, label }: { items: CurrencyAmountDto[]; label: string }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => Math.abs(i.amount)), 1);
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase text-muted">{label}</p>
      {items.map((item) => (
        <div key={item.currency} className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-xs">{CURRENCY_TYPE_LABELS[item.currency]}</span>
          <div className="h-2 flex-1 rounded-full bg-border">
            <div
              className="h-2 rounded-full bg-accent-yellow"
              style={{ width: `${(Math.abs(item.amount) / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-semibold">
            {item.amount.toLocaleString("ru-RU")}
          </span>
        </div>
      ))}
    </div>
  );
}

function CurrencyTable({ items, label, caption }: { items: CurrencyAmountDto[]; label: string; caption: string }) {
  if (items.length === 0) return null;
  return (
    <table className="w-full text-xs">
      <caption className="mb-1 text-left text-[10px] font-semibold uppercase text-muted">
        {label}
        <span className="sr-only"> — {caption}</span>
      </caption>
      <thead>
        <tr>
          <th scope="col" className="text-left font-medium text-muted">
            Валюта
          </th>
          <th scope="col" className="text-right font-medium text-muted">
            Сумма
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.currency}>
            <td>{CURRENCY_TYPE_LABELS[item.currency]}</td>
            <td className="text-right font-semibold">{item.amount.toLocaleString("ru-RU")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PullSummary({ pulls }: { pulls: BannerPullCountDto[] }) {
  if (pulls.length === 0) return null;
  return (
    <p className="text-xs text-muted">
      Круток: {pulls.map((p) => `${p.bannerFamily} — ${p.pulls}`).join(", ")}
    </p>
  );
}

function BucketSection({
  title,
  income,
  expense,
  pulls,
  view,
}: {
  title: string;
  income: CurrencyAmountDto[];
  expense: CurrencyAmountDto[];
  pulls: BannerPullCountDto[];
  view: View;
}) {
  const isEmpty = income.length === 0 && expense.length === 0 && pulls.length === 0;
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <h3 className="text-xs font-bold">{title}</h3>
      {isEmpty && <p className="text-xs text-muted">Нет данных за этот период.</p>}
      {view === "chart" ? (
        <>
          <CurrencyBarList items={income} label="Доход" />
          <CurrencyBarList items={expense} label="Расход" />
        </>
      ) : (
        <>
          <CurrencyTable items={income} label="Доход" caption={`${title}: доход`} />
          <CurrencyTable items={expense} label="Расход" caption={`${title}: расход`} />
        </>
      )}
      <PullSummary pulls={pulls} />
    </div>
  );
}

/**
 * "Actual through today" / "Scheduled ahead" / "Expected range total" —
 * NOT "actual vs forecast": no historical forecast snapshot is persisted
 * anywhere, so this never claims to check whether a past prediction was
 * right. All three are computed live, from the same request, against the
 * currently-scheduled series and currently-logged transactions.
 */
export function TotalsPanel({ overview }: { overview: StatisticsOverviewDto }) {
  const [view, setView] = useState<View>("chart");

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Итоги за период</h2>
        <button
          type="button"
          onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
          className="min-h-11 rounded-full border border-border px-3 text-xs font-semibold"
        >
          {view === "chart" ? "Показать таблицей" : "Показать графиком"}
        </button>
      </div>

      <BucketSection
        title="Факт по сегодня"
        income={overview.actual.incomeTotals}
        expense={overview.actual.expenseTotals}
        pulls={overview.actual.pullTotals}
        view={view}
      />
      <BucketSection
        title="Запланировано вперёд"
        income={overview.scheduled.incomeTotals}
        expense={overview.scheduled.expenseTotals}
        pulls={overview.scheduled.pullTotals}
        view={view}
      />
      <BucketSection
        title="Ожидаемый итог за период"
        income={overview.expectedRangeTotal.income}
        expense={overview.expectedRangeTotal.expense}
        pulls={overview.expectedRangeTotal.pulls}
        view={view}
      />
    </section>
  );
}
