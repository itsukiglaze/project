"use client";

import Link from "next/link";
import { BannerFamily, type BannerConfig } from "@/config/gacha";
import { calculateRemainingToHardPityFor } from "@/lib/gacha-math";
import type { BannerStateFieldsState } from "./types";
import { getMechanismLabel } from "./types";
import type { SavedPityState } from "./use-saved-profile-snapshot";
import { NumericField } from "./numeric-field";
import { SourceModeToggle } from "./source-mode-toggle";
import { StepSection } from "./step-section";

function parsedPityOrNull(raw: string, hardPity: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return value >= 0 && value < hardPity ? value : null;
}

/** "Сначала сохраните … в настройках или выберите «Ввести вручную»." — shared copy with ResourceFields' fallback. */
function SavedDataFallback({ what }: { what: string }) {
  return (
    <div className="space-y-2 rounded-xl border border-accent-orange/40 bg-accent-orange/10 p-3">
      <p className="text-xs font-medium text-foreground">
        Сначала сохраните {what} в настройках или выберите «Ввести вручную».
      </p>
      <Link
        href="/settings"
        className="inline-block min-h-11 rounded-lg bg-surface-contrast px-3 py-2 text-xs font-semibold text-background"
      >
        Перейти в настройки
      </Link>
    </div>
  );
}

/** The one-line guarantee-state sentence, shared between saved and manual-preview display. */
function GuaranteeStateLine({
  family,
  config,
  guaranteeActive,
}: {
  family: BannerFamily;
  config: BannerConfig;
  guaranteeActive: boolean;
}) {
  if (config.selectedTargetAlways) {
    return <p className="text-xs text-muted">Выбранный Bangboo гарантирован при каждом S-ранге.</p>;
  }
  if (family === BannerFamily.STABLE) {
    return (
      <p className="text-xs text-muted">
        Гарантирован любой S-ранг — конкретная цель здесь не гарантируется.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted">
      {guaranteeActive
        ? "Следующий S-ранг гарантированно целевой."
        : `Следующий S-ранг участвует в ${getMechanismLabel(config)}.`}
    </p>
  );
}

export function PityFields({
  family,
  config,
  useSaved,
  onUseSavedChange,
  values,
  errors,
  onChange,
  onToggleGuarantee,
  savedState,
}: {
  family: BannerFamily;
  config: BannerConfig;
  useSaved: boolean;
  onUseSavedChange: (useSaved: boolean) => void;
  values: BannerStateFieldsState;
  errors: Record<string, string>;
  onChange: (field: "sRankPity" | "aRankPity", value: string) => void;
  onToggleGuarantee: () => void;
  savedState: SavedPityState;
}) {
  const previewPity = useSaved ? null : parsedPityOrNull(values.sRankPity, config.hardPityS);
  const remaining =
    previewPity !== null ? calculateRemainingToHardPityFor(config, previewPity) : null;

  return (
    <StepSection step={3} title="Какое состояние pity использовать?">
      <SourceModeToggle
        useSaved={useSaved}
        onChange={onUseSavedChange}
        savedLabel="Сохранённое pity"
        temporaryLabel="Ввести вручную"
        groupName={`${family}-pity-source`}
      />

      {useSaved ? (
        savedState.status === "loading" ? (
          <p className="text-xs text-muted">Загружаем сохранённое pity…</p>
        ) : savedState.status === "available" ? (
          <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
            <p className="text-xs">
              <span className="text-muted">Текущее pity: </span>
              <span className="font-semibold text-foreground">
                {savedState.snapshot.sRankPity} из {config.hardPityS}
              </span>
            </p>
            <GuaranteeStateLine
              family={family}
              config={config}
              guaranteeActive={savedState.snapshot.guaranteeActive}
            />
          </div>
        ) : (
          <SavedDataFallback what="pity" />
        )
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Сколько круток прошло с последнего S-ранга и A-ранга на этом канале.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumericField
              id={`${family}-s-rank-pity`}
              label={`S-rank pity (0–${config.hardPityS - 1})`}
              value={values.sRankPity}
              onChange={(value) => onChange("sRankPity", value)}
              error={errors.sRankPity}
            />
            <NumericField
              id={`${family}-a-rank-pity`}
              label={`A-rank pity (0–${config.hardPityA - 1})`}
              value={values.aRankPity}
              onChange={(value) => onChange("aRankPity", value)}
              error={errors.aRankPity}
            />
          </div>

          {previewPity !== null && remaining !== null && (
            <p className="text-xs text-muted">
              Текущий pity: {previewPity} из {config.hardPityS}. До следующего S-rank максимум{" "}
              {remaining} круток.
            </p>
          )}

          {config.selectedTargetAlways ? (
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked disabled className="h-5 w-5" />
              Выбранный Bangboo гарантирован — переключатель гарантии здесь не нужен
            </label>
          ) : family === BannerFamily.STABLE ? (
            <p className="text-xs text-muted">
              Stable Channel гарантирует любой S-ранг по достижении hard pity, но не конкретного
              персонажа или W-Engine.
            </p>
          ) : (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.guaranteeActive}
                onChange={onToggleGuarantee}
                className="h-5 w-5"
              />
              Гарантия уже активна (предыдущий S-ранг был не целевым)
            </label>
          )}
        </div>
      )}
    </StepSection>
  );
}
