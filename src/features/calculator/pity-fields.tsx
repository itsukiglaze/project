"use client";

import { BannerFamily, type BannerConfig } from "@/config/gacha";
import { calculateRemainingToHardPityFor } from "@/lib/gacha-math";
import type { BannerStateFieldsState } from "./types";
import { NumericField } from "./numeric-field";
import { SourceModeToggle } from "./source-mode-toggle";

function parsedPityOrNull(raw: string, hardPity: number): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return value >= 0 && value < hardPity ? value : null;
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
}: {
  family: BannerFamily;
  config: BannerConfig;
  useSaved: boolean;
  onUseSavedChange: (useSaved: boolean) => void;
  values: BannerStateFieldsState;
  errors: Record<string, string>;
  onChange: (field: "sRankPity" | "aRankPity", value: string) => void;
  onToggleGuarantee: () => void;
}) {
  const previewPity = useSaved ? null : parsedPityOrNull(values.sRankPity, config.hardPityS);
  const remaining =
    previewPity !== null ? calculateRemainingToHardPityFor(config, previewPity) : null;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">Текущее состояние pity</h2>
      <SourceModeToggle useSaved={useSaved} onChange={onUseSavedChange} />

      {useSaved ? (
        <p className="text-xs text-muted">
          Будет использовано сохранённое состояние pity из вашего профиля на момент расчёта.
        </p>
      ) : (
        <div className="space-y-3">
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
    </section>
  );
}
