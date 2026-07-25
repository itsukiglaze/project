"use client";

import { BannerFamilySelector } from "./banner-family-selector";
import { ResourceFields } from "./resource-fields";
import { PityFields } from "./pity-fields";
import { GoalFields } from "./goal-fields";
import { CalculationSummary, getSubmitBlockReason } from "./calculation-summary";
import { CalculationResult } from "./calculation-result";
import { UnsupportedResult } from "./unsupported-result";
import { CalculationError } from "./calculation-error";
import { useCalculatorForm } from "./use-calculator-form";
import { useSavedProfileSnapshot } from "./use-saved-profile-snapshot";
import { hasClientFieldErrors } from "./build-request";
import { useAuth } from "@/components/providers/auth-provider";

export function CalculatorForm() {
  const {
    activeFamily,
    setActiveFamily,
    config,
    formState,
    clientFieldErrors,
    uiState,
    isSubmitting,
    canSubmit,
    updateResourceField,
    toggleIncludeMonochrome,
    updateBannerStateField,
    toggleGuaranteeActive,
    updateTargetCopies,
    setUseSavedResources,
    setUseSavedBannerState,
    submit,
  } = useCalculatorForm();

  const { status: authStatus } = useAuth();
  const savedProfile = useSavedProfileSnapshot(authStatus === "authenticated");
  const resourcesState = savedProfile.resources;
  const pityState = savedProfile.getPity(activeFamily);

  const blockReason = getSubmitBlockReason({
    hasFieldErrors: hasClientFieldErrors(clientFieldErrors),
    useSavedResources: formState.useSavedResources,
    resourcesState,
    useSavedBannerState: formState.useSavedBannerState,
    pityState,
  });
  const disabled = !canSubmit || blockReason !== null;

  return (
    <div className="space-y-4 p-4 pt-6">
      <header>
        <h1 className="text-xl font-bold">Калькулятор круток</h1>
        <p className="text-xs text-muted">
          Расчёт основан на гарантированном худшем сценарии (hard pity), а не на вероятности.
        </p>
      </header>

      <BannerFamilySelector activeFamily={activeFamily} onChange={setActiveFamily} />

      <ResourceFields
        family={activeFamily}
        config={config}
        useSaved={formState.useSavedResources}
        onUseSavedChange={setUseSavedResources}
        values={formState.resources}
        errors={clientFieldErrors}
        onChange={updateResourceField}
        onToggleIncludeMonochrome={toggleIncludeMonochrome}
        savedState={resourcesState}
      />

      <PityFields
        family={activeFamily}
        config={config}
        useSaved={formState.useSavedBannerState}
        onUseSavedChange={setUseSavedBannerState}
        values={formState.bannerState}
        errors={clientFieldErrors}
        onChange={updateBannerStateField}
        onToggleGuarantee={toggleGuaranteeActive}
        savedState={pityState}
      />

      <GoalFields
        family={activeFamily}
        targetCopies={formState.targetCopies}
        onChange={updateTargetCopies}
        error={clientFieldErrors.targetCopies}
      />

      <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
        <CalculationSummary
          family={activeFamily}
          config={config}
          formState={formState}
          pityState={pityState}
        />

        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          aria-describedby={blockReason ? "calculator-block-reason" : undefined}
          className="min-h-11 w-full rounded-xl bg-accent-yellow text-sm font-bold text-black disabled:opacity-40"
        >
          {isSubmitting ? "Считаем…" : "Рассчитать"}
        </button>

        {blockReason && (
          <p id="calculator-block-reason" className="text-xs text-accent-red">
            {blockReason}
          </p>
        )}
      </div>

      {uiState.status === "calculated" && (
        <CalculationResult data={uiState.data} config={config} stale={uiState.stale} />
      )}

      {uiState.status === "unsupported" && (
        <UnsupportedResult reason={uiState.data.reason} stale={uiState.stale} />
      )}

      {(uiState.status === "validation_error" ||
        uiState.status === "auth_error" ||
        uiState.status === "network_error" ||
        uiState.status === "unknown_error") && (
        <CalculationError state={uiState} onRetry={submit} />
      )}
    </div>
  );
}
