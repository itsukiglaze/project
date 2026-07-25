"use client";

import { BannerFamily } from "@/config/gacha";
import { ALL_FAMILIES, getFamilyDisplayInfo } from "./types";
import { RadioOption } from "./radio-option";
import { StepSection } from "./step-section";

const RADIO_GROUP_NAME = "calculator-banner-family";

export function BannerFamilySelector({
  activeFamily,
  onChange,
}: {
  activeFamily: BannerFamily;
  onChange: (family: BannerFamily) => void;
}) {
  const selected = getFamilyDisplayInfo(activeFamily);

  return (
    <StepSection step={1} title="Выберите тип баннера" onboardingTarget="banner-selector">
      <div className="grid grid-cols-2 gap-2">
        {ALL_FAMILIES.map((family) => {
          const info = getFamilyDisplayInfo(family);
          const isActive = family === activeFamily;
          return (
            <RadioOption
              key={family}
              name={RADIO_GROUP_NAME}
              value={family}
              checked={isActive}
              onChange={(value) => onChange(value as BannerFamily)}
              className="min-h-[72px] cursor-pointer rounded-2xl border border-border bg-surface p-3 text-left text-foreground transition-colors has-[:checked]:border-accent-yellow has-[:checked]:bg-surface-contrast has-[:checked]:text-background has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-yellow"
            >
              <span className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold">{info.label}</span>
                {/* Selection is never colour-only — an explicit checkmark backs the border/background change. */}
                {isActive && (
                  <span aria-hidden="true" className="text-xs font-bold">
                    ✓
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs text-muted peer-checked:text-background/70">
                Hard pity S: {info.hardPityS}
              </span>
            </RadioOption>
          );
        })}
      </div>

      {/* The selected banner's own summary — visually one block, tied to the current selection, not detached text below an unrelated grid. */}
      <div
        key={activeFamily}
        role="status"
        className="rounded-xl border border-accent-yellow/50 bg-accent-yellow/10 p-3"
      >
        <p className="text-sm font-bold">{selected.label}</p>
        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted">
          <div className="flex gap-1">
            <dt>Hard pity:</dt>
            <dd className="font-semibold text-foreground">{selected.hardPityS}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Механика:</dt>
            <dd className="font-semibold text-foreground">{selected.mechanismLabel}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">{selected.guaranteeSummary}</p>
      </div>
    </StepSection>
  );
}
