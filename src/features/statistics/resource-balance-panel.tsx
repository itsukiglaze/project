"use client";

import { CurrencyType } from "@/lib/calendar-math";
import { useQuery } from "@/lib/query/use-query";
import { fetchResourceSnapshot } from "@/features/profile/api";
import { CURRENCY_TYPE_LABELS } from "@/features/calendar/labels";

const CURRENCY_ORDER: CurrencyType[] = [
  CurrencyType.POLYCHROME,
  CurrencyType.MONOCHROME,
  CurrencyType.ENCRYPTED_MASTER_TAPE,
  CurrencyType.MASTER_TAPE,
  CurrencyType.BOOPON,
];

/**
 * Shows the 5 currency balances INDEPENDENTLY — no percentage-of-total or
 * distribution chart. Polychrome, Monochrome, Encrypted Master Tape,
 * Master Tape, and Boopon are not one common unit; combining them into a
 * single "distribution" would misrepresent the data. See
 * banner-pity-panel.tsx for the one place a real Polychrome->pulls
 * conversion is shown, in the context it actually applies to.
 */
export function ResourceBalancePanel() {
  const query = useQuery("statistics:resource-balance", () => fetchResourceSnapshot());

  if (query.status === "loading") {
    return <div className="animate-pulse rounded-2xl bg-border p-4" style={{ height: 160 }} />;
  }

  if (query.status === "error") {
    return (
      <section role="alert" className="rounded-2xl border border-accent-red/40 bg-accent-red/5 p-4 text-sm">
        Не удалось загрузить баланс ресурсов.
      </section>
    );
  }

  const balance = query.data;
  const amountByCurrency: Record<CurrencyType, number> = {
    [CurrencyType.POLYCHROME]: balance.polychrome,
    [CurrencyType.MONOCHROME]: balance.monochrome,
    [CurrencyType.ENCRYPTED_MASTER_TAPE]: balance.encryptedMasterTape,
    [CurrencyType.MASTER_TAPE]: balance.masterTape,
    [CurrencyType.BOOPON]: balance.boopon,
  };

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">Текущий баланс ресурсов</h2>
      <p className="text-xs text-muted">
        Каждая валюта показана независимо — они не складываются в одну сумму.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CURRENCY_ORDER.map((currency) => (
          <div key={currency} className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted">{CURRENCY_TYPE_LABELS[currency]}</p>
            <p className="text-lg font-bold">{amountByCurrency[currency].toLocaleString("ru-RU")}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
