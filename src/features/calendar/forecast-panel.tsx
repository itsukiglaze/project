"use client";

import { CurrencyType, parseLocalDate } from "@/lib/calendar-math";
import { useForecastQuery } from "./use-calendar-queries";
import { summarizeIncomeByCurrency, distinctCurrencies } from "./forecast-currency-summary";
import { CURRENCY_TYPE_LABELS } from "./labels";
import { formatHumanDate } from "./date-format";

const FORECAST_HORIZON_DAYS = 30;

function currencyLabel(currency: CurrencyType | null): string {
  return currency ? CURRENCY_TYPE_LABELS[currency] : "";
}

export function ForecastPanel({ enabled = true }: { enabled?: boolean }) {
  const query = useForecastQuery(FORECAST_HORIZON_DAYS, enabled);

  if (query.status === "loading") {
    return <div className="animate-pulse rounded-2xl bg-border p-4" style={{ height: 96 }} />;
  }

  if (query.status === "error") {
    return (
      <section
        role="alert"
        className="space-y-2 rounded-2xl border border-accent-red/40 bg-accent-red/5 p-4 text-sm"
      >
        <p>Не удалось загрузить прогноз.</p>
        <button
          type="button"
          onClick={query.refetch}
          className="min-h-11 w-full rounded-xl bg-surface-contrast text-sm font-semibold text-background"
        >
          Повторить загрузку прогноза
        </button>
      </section>
    );
  }

  const { data } = query;
  const incomeTotals = summarizeIncomeByCurrency(data.occurrences);
  // Never a bare, unit-less number — when nothing is expected yet, show an
  // explicit zero in the default currency rather than omitting the row.
  const incomeRows = incomeTotals.length > 0 ? incomeTotals : [{ currency: CurrencyType.POLYCHROME, total: 0 }];

  const currencies = distinctCurrencies(data.occurrences);
  // The server's single `projectedEndingBalance` sums every currency
  // together (see forecast.ts) — only honest to label with one currency's
  // unit when exactly one (or none) is actually in play this window.
  const balanceCurrency =
    currencies.length === 1 ? currencies[0] : currencies.length === 0 ? CurrencyType.POLYCHROME : null;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Прогноз на ближайшие {data.effectiveHorizonDays} дней</h2>
        {/* Plain text, not a button — must never be mistaken for an interactive control. */}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Примерный прогноз
        </span>
      </div>
      <p className="text-xs text-muted">
        Прогноз строится на основе активных регулярных источников и не гарантирует фактическое получение
        ресурсов.
      </p>

      <div>
        <p className="text-xs font-semibold text-muted">Ожидаемые поступления</p>
        {incomeRows.map((row) => (
          <p key={row.currency ?? "none"} className="text-2xl font-bold">
            {row.total.toLocaleString("ru-RU")} {currencyLabel(row.currency)}
          </p>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-muted">
          Баланс к {formatHumanDate(parseLocalDate(data.rangeEnd), true)}
        </p>
        {balanceCurrency !== null ? (
          <p className="text-2xl font-bold">
            {data.projectedEndingBalance.toLocaleString("ru-RU")} {currencyLabel(balanceCurrency)}
          </p>
        ) : (
          <p className="text-xs text-muted">
            Итоговый баланс недоступен одной суммой — источники используют разные валюты. Суммы
            поступлений по каждой валюте показаны выше.
          </p>
        )}
      </div>
    </section>
  );
}
