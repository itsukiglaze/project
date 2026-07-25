"use client";

import Link from "next/link";
import { BannerFamily, PullCurrency, type BannerConfig } from "@/config/gacha";
import type { ResourceFieldsState } from "./types";
import type { SavedResourceState } from "./use-saved-profile-snapshot";
import { NumericField } from "./numeric-field";
import { SourceModeToggle } from "./source-mode-toggle";
import { StepSection } from "./step-section";

/** "Сначала сохраните … в настройках или выберите «Ввести вручную»." — shown whenever saved data is selected but genuinely unavailable (never silently treated as zero). */
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

function ResourceSummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}:</span>
      <span className="font-semibold text-foreground">{value.toLocaleString("ru-RU")}</span>
    </div>
  );
}

export function ResourceFields({
  family,
  config,
  useSaved,
  onUseSavedChange,
  values,
  errors,
  onChange,
  onToggleIncludeMonochrome,
  savedState,
}: {
  family: BannerFamily;
  config: BannerConfig;
  useSaved: boolean;
  onUseSavedChange: (useSaved: boolean) => void;
  values: ResourceFieldsState;
  errors: Record<string, string>;
  onChange: (field: keyof Omit<ResourceFieldsState, "includeMonochrome">, value: string) => void;
  onToggleIncludeMonochrome: () => void;
  savedState: SavedResourceState;
}) {
  const isBangboo = config.currency === PullCurrency.BOOPON;

  return (
    <StepSection step={2} title="Какие ресурсы использовать?">
      <SourceModeToggle
        useSaved={useSaved}
        onChange={onUseSavedChange}
        savedLabel="Сохранённые данные"
        temporaryLabel="Ввести вручную"
        groupName={`${family}-resource-source`}
      />

      {useSaved ? (
        savedState.status === "loading" ? (
          <p className="text-xs text-muted">Загружаем сохранённые данные…</p>
        ) : savedState.status === "available" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Используем последние сохранённые значения ресурсов из вашего профиля.
            </p>
            <div className="space-y-1 rounded-xl border border-border bg-background/40 p-3">
              {isBangboo ? (
                <ResourceSummaryRow label="Boopon" value={savedState.snapshot.boopon} />
              ) : (
                <>
                  <ResourceSummaryRow label="Полихромы" value={savedState.snapshot.polychrome} />
                  {config.currency === PullCurrency.ENCRYPTED_MASTER_TAPE ? (
                    <ResourceSummaryRow
                      label="Шифр-кассеты"
                      value={savedState.snapshot.encryptedMasterTape}
                    />
                  ) : (
                    <ResourceSummaryRow label="Обычные кассеты" value={savedState.snapshot.masterTape} />
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <SavedDataFallback what="ресурсы" />
        )
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Эти значения временные — они используются только для этого расчёта и не сохраняются в
            профиль.
          </p>
          {isBangboo ? (
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
        </div>
      )}
    </StepSection>
  );
}
