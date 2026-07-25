"use client";

import { BannerFamily, type BannerConfig } from "@/config/gacha";
import type { BannerStateFieldsState, FamilyFormState } from "./types";
import { getFamilyDisplayInfo, goalChipLabel } from "./types";
import type { SavedPityState, SavedResourceState } from "./use-saved-profile-snapshot";

export interface SubmitBlockContext {
  hasFieldErrors: boolean;
  useSavedResources: boolean;
  resourcesState: SavedResourceState;
  useSavedBannerState: boolean;
  pityState: SavedPityState;
}

/**
 * The exact, distinct reason the Calculate button is currently disabled —
 * never just a generic "заполните форму". Checked in priority order: a
 * field the user typed is invalid comes first (it's the most actionable),
 * then whichever saved-data source is still loading or missing.
 */
export function getSubmitBlockReason(ctx: SubmitBlockContext): string | null {
  if (ctx.hasFieldErrors) {
    return "Проверьте введённые значения — есть ошибки в полях.";
  }
  if (ctx.useSavedResources) {
    if (ctx.resourcesState.status === "loading") return "Загружаем сохранённые ресурсы…";
    if (ctx.resourcesState.status !== "available") {
      return "Нет сохранённых ресурсов — сохраните их в настройках или выберите «Ввести вручную».";
    }
  }
  if (ctx.useSavedBannerState) {
    if (ctx.pityState.status === "loading") return "Загружаем сохранённое pity…";
    if (ctx.pityState.status !== "available") {
      return "Нет сохранённого pity — сохраните его в настройках или выберите «Ввести вручную».";
    }
  }
  return null;
}

function goalSummaryLabel(family: BannerFamily, targetCopies: string): string {
  if (family === BannerFamily.STABLE) return "ближайший S-ранг";
  const copies = Number(targetCopies);
  if (!Number.isInteger(copies) || copies < 1) return "цель не выбрана";
  return goalChipLabel(family, copies);
}

function pitySummaryFragment(
  useSavedBannerState: boolean,
  bannerState: BannerStateFieldsState,
  pityState: SavedPityState,
  config: BannerConfig,
): string | null {
  if (useSavedBannerState) {
    return pityState.status === "available"
      ? `pity ${pityState.snapshot.sRankPity}/${config.hardPityS}`
      : null;
  }
  const manual = Number(bannerState.sRankPity);
  if (!Number.isInteger(manual) || manual < 0 || manual >= config.hardPityS) return null;
  return `pity ${manual}/${config.hardPityS}`;
}

/**
 * "Рассчитаем худший гарантированный сценарий для: … · … · … · pity N/M" —
 * shown above the Calculate button so the exact inputs about to be used
 * are visible before submitting, not only after.
 */
export function CalculationSummary({
  family,
  config,
  formState,
  pityState,
}: {
  family: BannerFamily;
  config: BannerConfig;
  formState: FamilyFormState;
  pityState: SavedPityState;
}) {
  const familyLabel = getFamilyDisplayInfo(family).label;
  const goalLabel = goalSummaryLabel(family, formState.targetCopies);
  const resourceSourceLabel = formState.useSavedResources ? "сохранённые ресурсы" : "ресурсы вручную";
  const pityFragment = pitySummaryFragment(
    formState.useSavedBannerState,
    formState.bannerState,
    pityState,
    config,
  );

  const parts = [familyLabel, goalLabel, resourceSourceLabel, pityFragment].filter(
    (part): part is string => Boolean(part),
  );

  return (
    <p className="text-xs text-muted">
      Рассчитаем худший гарантированный сценарий для:
      <br />
      <span className="font-semibold text-foreground">{parts.join(" · ")}</span>
    </p>
  );
}
