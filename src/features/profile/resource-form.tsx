"use client";

import { NumericField } from "@/features/calculator/numeric-field";
import { DiffPreview } from "./diff-preview";
import { useResourceForm } from "./use-resource-form";
import type { ResourceSnapshot } from "./api";

const LABELS: Record<keyof ResourceSnapshot, string> = {
  polychrome: "Полихромы",
  monochrome: "Монокромы",
  encryptedMasterTape: "Шифр-кассеты",
  masterTape: "Обычные кассеты",
  boopon: "Boopon",
};

export function ResourceForm() {
  const {
    phase,
    message,
    draft,
    previewChanges,
    fieldErrors,
    updateField,
    openPreview,
    cancelPreview,
    confirmSave,
    reloadAfterConflict,
    canOpenPreview,
  } = useResourceForm();

  if (phase === "loading") {
    return <div className="animate-pulse rounded-2xl bg-border p-4" style={{ height: 220 }} />;
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
        <h2 className="text-sm font-bold">Ресурсы профиля</h2>
        <div className="grid grid-cols-2 gap-3">
          <NumericField
            id="profile-polychrome"
            label={LABELS.polychrome}
            value={draft.polychrome}
            onChange={(v) => updateField("polychrome", v)}
            error={fieldErrors.polychrome}
          />
          <NumericField
            id="profile-monochrome"
            label={LABELS.monochrome}
            value={draft.monochrome}
            onChange={(v) => updateField("monochrome", v)}
            error={fieldErrors.monochrome}
          />
          <NumericField
            id="profile-encrypted-master-tape"
            label={LABELS.encryptedMasterTape}
            value={draft.encryptedMasterTape}
            onChange={(v) => updateField("encryptedMasterTape", v)}
            error={fieldErrors.encryptedMasterTape}
          />
          <NumericField
            id="profile-master-tape"
            label={LABELS.masterTape}
            value={draft.masterTape}
            onChange={(v) => updateField("masterTape", v)}
            error={fieldErrors.masterTape}
          />
          <NumericField
            id="profile-boopon"
            label={LABELS.boopon}
            value={draft.boopon}
            onChange={(v) => updateField("boopon", v)}
            error={fieldErrors.boopon}
          />
        </div>

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
