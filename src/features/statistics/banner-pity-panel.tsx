"use client";

import { useState } from "react";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import {
  calculateAvailablePulls,
  calculateFirstTargetWorstCase,
  calculateRemainingToHardPityFor,
} from "@/lib/gacha-math";
import { useQuery } from "@/lib/query/use-query";
import { fetchAllBannerStates, fetchResourceSnapshot } from "@/features/profile/api";

const FAMILY_LABELS: Record<BannerFamily, string> = {
  [BannerFamily.EXCLUSIVE_AGENT]: "Эксклюзивный агент",
  [BannerFamily.W_ENGINE]: "W-Engine",
  [BannerFamily.STABLE]: "Stable",
  [BannerFamily.BANGBOO]: "Bangboo",
};

/**
 * Per-family pity/guarantee summary, reusing the exact same pure functions
 * the Calculator feature already trusts (gacha-math/pity.ts, guarantee.ts,
 * resources.ts) — no new pity/guarantee math is introduced here.
 *
 * Stable has no featured-item guarantee at all (see gacha-math/index.ts's
 * UNSUPPORTED_TARGET handling for the Calculator) — shown without a
 * worst-case-for-target number, not a fabricated one.
 *
 * "Available pulls" correctly keeps Boopon separate from Polychrome
 * (calculateAvailablePulls never lets Bangboo draw on Polychrome) and only
 * folds Monochrome in when the user opts in via the toggle below — this
 * toggle is local UI state, not persisted, exactly mirroring the
 * Calculator's own existing behavior (UserSettings.includeMonochromeAsPolychrome
 * is schema-only and never read/written anywhere yet).
 */
export function BannerPityPanel() {
  const [includeMonochrome, setIncludeMonochrome] = useState(false);
  const bannerStatesQuery = useQuery("statistics:banner-states", () => fetchAllBannerStates());
  const resourcesQuery = useQuery("statistics:resource-balance-for-pity", () => fetchResourceSnapshot());

  if (bannerStatesQuery.status === "loading" || resourcesQuery.status === "loading") {
    return <div className="animate-pulse rounded-2xl bg-border p-4" style={{ height: 240 }} />;
  }

  if (bannerStatesQuery.status === "error" || resourcesQuery.status === "error") {
    return (
      <section role="alert" className="rounded-2xl border border-accent-red/40 bg-accent-red/5 p-4 text-sm">
        Не удалось загрузить состояние pity.
      </section>
    );
  }

  const resources = { ...resourcesQuery.data, includeMonochrome };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Pity и гарантия</h2>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={includeMonochrome}
            onChange={(e) => setIncludeMonochrome(e.target.checked)}
            className="h-5 w-5"
          />
          Учитывать Монокромы
        </label>
      </div>

      <div className="space-y-2">
        {bannerStatesQuery.data.bannerStates.map((state) => {
          const config = getBannerConfig(state.family);
          const remainingToHardPity = calculateRemainingToHardPityFor(config, state.sRankPity);
          const { availablePulls } = calculateAvailablePulls(state.family, resources);
          const isStable = state.family === BannerFamily.STABLE;
          const worstCaseForFirstCopy = isStable
            ? null
            : calculateFirstTargetWorstCase(config, state.sRankPity, state.guaranteeActive);

          return (
            <div key={state.family} className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">{FAMILY_LABELS[state.family]}</p>
              <p className="text-xs text-muted">
                Pity: {state.sRankPity}/{config.hardPityS} · Гарантия:{" "}
                {state.guaranteeActive ? "активна" : "нет"}
              </p>
              <p className="text-xs text-muted">
                Осталось круток до гарантированного S-ранга: {remainingToHardPity}
              </p>
              {worstCaseForFirstCopy !== null ? (
                <p className="text-xs text-muted">
                  Худший случай для первой целевой копии: {worstCaseForFirstCopy} круток
                </p>
              ) : (
                <p className="text-xs text-muted">
                  Stable Channel не имеет механики гарантии featured-предмета.
                </p>
              )}
              <p className="text-xs font-semibold">Доступно круток: {availablePulls}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
