"use client";

import { BannerFamily } from "@/config/gacha";
import { MAX_TARGET_COPIES } from "./field-validation";
import { NumericField } from "./numeric-field";

export function GoalFields({
  family,
  targetCopies,
  onChange,
  error,
}: {
  family: BannerFamily;
  targetCopies: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">Цель</h2>

      {family === BannerFamily.STABLE ? (
        <p className="text-xs text-muted">
          Stable Channel не гарантирует конкретного персонажа или W-Engine — здесь можно
          посмотреть только расстояние до ближайшего S-ранга (см. блок pity выше), а не
          гарантированное получение выбранной цели.
        </p>
      ) : (
        <NumericField
          id={`${family}-target-copies`}
          label={`Количество копий (1–${MAX_TARGET_COPIES})`}
          value={targetCopies}
          onChange={onChange}
          error={error}
        />
      )}
    </section>
  );
}
