"use client";

import { BannerFamily, PullCurrency, type BannerConfig } from "@/config/gacha";
import type { ResourceFieldsState } from "./types";
import { NumericField } from "./numeric-field";
import { SourceModeToggle } from "./source-mode-toggle";

export function ResourceFields({
  family,
  config,
  useSaved,
  onUseSavedChange,
  values,
  errors,
  onChange,
  onToggleIncludeMonochrome,
}: {
  family: BannerFamily;
  config: BannerConfig;
  useSaved: boolean;
  onUseSavedChange: (useSaved: boolean) => void;
  values: ResourceFieldsState;
  errors: Record<string, string>;
  onChange: (field: keyof Omit<ResourceFieldsState, "includeMonochrome">, value: string) => void;
  onToggleIncludeMonochrome: () => void;
}) {
  const isBangboo = config.currency === PullCurrency.BOOPON;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">Текущие ресурсы</h2>
      <SourceModeToggle useSaved={useSaved} onChange={onUseSavedChange} />

      {useSaved ? (
        <p className="text-xs text-muted">
          Будут использованы сохранённые данные из вашего профиля на момент расчёта.
        </p>
      ) : isBangboo ? (
        <NumericField
          id={`${family}-boopon`}
          label="Boopon"
          value={values.boopon}
          onChange={(value) => onChange("boopon", value)}
          error={errors.boopon}
        />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumericField
              id={`${family}-polychrome`}
              label="Полихромы"
              value={values.polychrome}
              onChange={(value) => onChange("polychrome", value)}
              error={errors.polychrome}
            />
            {config.currency === PullCurrency.ENCRYPTED_MASTER_TAPE ? (
              <NumericField
                id={`${family}-encrypted-master-tape`}
                label="Шифр-кассеты"
                value={values.encryptedMasterTape}
                onChange={(value) => onChange("encryptedMasterTape", value)}
                error={errors.encryptedMasterTape}
              />
            ) : (
              <NumericField
                id={`${family}-master-tape`}
                label="Обычные кассеты"
                value={values.masterTape}
                onChange={(value) => onChange("masterTape", value)}
                error={errors.masterTape}
              />
            )}
          </div>
          <NumericField
            id={`${family}-monochrome`}
            label="Монокромы"
            value={values.monochrome}
            onChange={(value) => onChange("monochrome", value)}
            error={errors.monochrome}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.includeMonochrome}
              onChange={onToggleIncludeMonochrome}
              className="h-5 w-5"
            />
            Учитывать монокромы как полихромы (1:1)
          </label>
        </div>
      )}
    </section>
  );
}
