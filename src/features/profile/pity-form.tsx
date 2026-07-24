"use client";

import { useEffect, useRef, useState } from "react";
import { BannerFamily } from "@/config/gacha";
import { BannerFamilySelector } from "@/features/calculator/banner-family-selector";
import { NumericField } from "@/features/calculator/numeric-field";
import { DiffPreview } from "./diff-preview";
import { usePityForm } from "./use-pity-form";
import type { BannerStateSnapshot } from "./api";

const LABELS: Record<keyof BannerStateSnapshot, string> = {
  sRankPity: "S-rank pity",
  aRankPity: "A-rank pity",
  guaranteeActive: "Гарантия активна",
};

function PityFormForFamily({
  family,
  onDirtyChange,
}: {
  family: BannerFamily;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const {
    config,
    phase,
    message,
    draft,
    previewChanges,
    fieldErrors,
    isDirty,
    updateField,
    toggleGuarantee,
    openPreview,
    cancelPreview,
    confirmSave,
    reloadAfterConflict,
    canOpenPreview,
  } = usePityForm(family);

  useEffect(() => {
    // "Dirty" for the purposes of warning-before-switch means there's an
    // in-progress preview/edit that hasn't been saved yet — not merely
    // that the draft differs (that's covered by isDirty too, both count).
    onDirtyChange(isDirty || phase === "previewing" || phase === "save_error" || phase === "conflict");
  }, [isDirty, phase, onDirtyChange]);

  if (phase === "loading") {
    return <div className="animate-pulse rounded-2xl bg-border p-4" style={{ height: 160 }} />;
  }

  if (phase === "load_error") {
    return (
      <section role="alert" className="rounded-2xl border border-accent-red/40 bg-accent-red/5 p-4 text-sm">
        {message}
      </section>
    );
  }

  if (phase === "conflict") {
    return (
      <section role="alert" className="space-y-3 rounded-2xl border border-accent-orange/40 bg-accent-orange/5 p-4 text-sm">
        <p>{message}</p>
        <button
          type="button"
          onClick={reloadAfterConflict}
          className="min-h-11 w-full rounded-xl bg-surface-contrast text-sm font-semibold text-background"
        >
          Обновить данные
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">Текущее состояние pity</h2>
        <div className="grid grid-cols-2 gap-3">
          <NumericField
            id="profile-s-rank-pity"
            label={`${LABELS.sRankPity} (0–${config.hardPityS - 1})`}
            value={draft.sRankPity}
            onChange={(v) => updateField("sRankPity", v)}
            error={fieldErrors.sRankPity}
          />
          <NumericField
            id="profile-a-rank-pity"
            label={`${LABELS.aRankPity} (0–${config.hardPityA - 1})`}
            value={draft.aRankPity}
            onChange={(v) => updateField("aRankPity", v)}
            error={fieldErrors.aRankPity}
          />
        </div>

        {config.selectedTargetAlways ? (
          <p className="text-xs text-muted">
            Выбранный Bangboo гарантирован — переключатель гарантии здесь не нужен.
          </p>
        ) : family === BannerFamily.STABLE ? (
          <p className="text-xs text-muted">
            Stable Channel не имеет featured-гарантии для конкретной цели.
          </p>
        ) : (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.guaranteeActive}
              onChange={toggleGuarantee}
              className="h-5 w-5"
            />
            {LABELS.guaranteeActive}
          </label>
        )}

        <button
          type="button"
          onClick={openPreview}
          disabled={!canOpenPreview}
          className="min-h-11 w-full rounded-xl bg-accent-yellow text-sm font-bold text-black disabled:opacity-40"
        >
          Просмотреть изменения
        </button>

        {phase === "saved" && (
          <p role="status" className="text-xs font-medium text-accent-yellow">
            Сохранено.
          </p>
        )}
        {phase === "save_error" && (
          <p role="alert" className="text-xs font-medium text-accent-red">
            {message}
          </p>
        )}
      </section>

      {(phase === "previewing" || phase === "saving" || phase === "save_error") && (
        <DiffPreview
          changes={previewChanges}
          labels={LABELS}
          onConfirm={confirmSave}
          onCancel={cancelPreview}
          confirming={phase === "saving"}
        />
      )}
    </div>
  );
}

export function PityForm() {
  const [family, setFamily] = useState<BannerFamily>(BannerFamily.EXCLUSIVE_AGENT);
  const isDirtyRef = useRef(false);

  const handleFamilyChange = (next: BannerFamily) => {
    if (next === family) return;
    if (isDirtyRef.current) {
      const confirmed = window.confirm(
        "Есть несохранённые изменения pity. Переключить семейство и потерять их?",
      );
      if (!confirmed) return;
    }
    setFamily(next);
  };

  return (
    <div className="space-y-3">
      <BannerFamilySelector activeFamily={family} onChange={handleFamilyChange} />
      {/* Keying by family remounts the inner form on switch, so its state
          (draft/baseline/phase) always starts fresh for the newly selected
          family instead of needing to sync an external prop change inside
          an effect. */}
      <PityFormForFamily
        key={family}
        family={family}
        onDirtyChange={(dirty) => {
          isDirtyRef.current = dirty;
        }}
      />
    </div>
  );
}
