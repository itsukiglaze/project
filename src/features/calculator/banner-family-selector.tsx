"use client";

import { BannerFamily } from "@/config/gacha";
import { ALL_FAMILIES, getFamilyDisplayInfo } from "./types";

export function BannerFamilySelector({
  activeFamily,
  onChange,
}: {
  activeFamily: BannerFamily;
  onChange: (family: BannerFamily) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        Семейство баннера
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {ALL_FAMILIES.map((family) => {
          const info = getFamilyDisplayInfo(family);
          const isActive = family === activeFamily;
          return (
            <button
              key={family}
              type="button"
              onClick={() => onChange(family)}
              aria-pressed={isActive}
              className={`min-h-[72px] rounded-2xl border p-3 text-left transition-colors ${
                isActive
                  ? "border-accent-yellow bg-surface-contrast text-background"
                  : "border-border bg-surface text-foreground"
              }`}
            >
              <p className="text-sm font-bold">{info.label}</p>
              <p className={`mt-1 text-xs ${isActive ? "text-background/70" : "text-muted"}`}>
                Hard pity S: {info.hardPityS}
              </p>
              <p className={`text-xs ${isActive ? "text-background/70" : "text-muted"}`}>
                {info.currencyLabel}
              </p>
            </button>
          );
        })}
      </div>
      <p className="px-1 text-xs text-muted">{getFamilyDisplayInfo(activeFamily).guaranteeSummary}</p>
    </fieldset>
  );
}
