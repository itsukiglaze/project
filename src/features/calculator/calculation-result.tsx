"use client";

import { PullCurrency, type BannerConfig } from "@/config/gacha";
import type { GuaranteedCalculationResult } from "@/lib/gacha-math";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export function CalculationResult({
  data,
  config,
  stale,
}: {
  data: GuaranteedCalculationResult;
  /** Used only to defensively gate Bangboo display — no formula reads this. */
  config: BannerConfig;
  stale: boolean;
}) {
  // Bangboo never uses Polychrome (requirement: "Полихромы нельзя
  // использовать для Bangboo"). The pure math layer already returns `null`
  // for this family, but the UI must not trust that alone — if a future
  // API bug ever sent a non-null value here anyway, this family check
  // still hides it rather than displaying a number that contradicts the
  // game rules.
  const showMissingPolychrome =
    data.missingPolychrome !== null && config.currency !== PullCurrency.BOOPON;

  // "Уже достижимо" — the target is reachable with what's already
  // available, no additional pulls needed. Purely a display grouping
  // decision derived from the existing missingPulls field — no new
  // calculation.
  const alreadyAchievable = data.missingPulls === 0;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Гарантированный максимум</h2>
        <span className="rounded-full bg-accent-yellow px-2 py-0.5 text-[10px] font-bold text-black">
          Худший сценарий
        </span>
      </div>
      <p className="text-xs text-muted">
        Это худший сценарий до hard pity, а не прогноз фактического выпадения.
      </p>

      {stale && (
        <p
          role="status"
          className="rounded-lg border border-accent-orange/40 bg-accent-orange/10 px-3 py-2 text-xs font-medium text-accent-orange"
        >
          Параметры изменены — выполните расчёт повторно.
        </p>
      )}

      {alreadyAchievable && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-accent-yellow/50 bg-accent-yellow/10 px-3 py-2 text-xs font-semibold text-foreground"
        >
          <span aria-hidden="true">✓</span>
          Цель уже достижима с имеющимися ресурсами — дополнительные крутки не нужны.
        </p>
      )}

      <ResultGroup title="Уже есть">
        <Stat label="Доступно круток" value={data.availablePulls} />
        <Stat label="Остаток полихромов" value={data.leftoverPolychrome} />
      </ResultGroup>

      {!alreadyAchievable && (
        <ResultGroup title="Нужно дополнительно">
          <Stat label="Не хватает круток" value={data.missingPulls} />
          {showMissingPolychrome && (
            <Stat label="Не хватает полихромов" value={data.missingPolychrome as number} />
          )}
        </ResultGroup>
      )}

      <ResultGroup title="Гарантированный расчёт (худший случай)">
        <Stat label="Нужно (худший случай)" value={data.totalRequiredPulls ?? "—"} />
        <Stat label="Первая копия" value={data.firstTargetCost ?? "—"} />
        {data.additionalTargetCost !== null && (
          <Stat label="Каждая доп. копия" value={data.additionalTargetCost} />
        )}
      </ResultGroup>

      {data.explanation.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Предположения расчёта
          </h3>
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
            {data.explanation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
