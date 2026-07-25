"use client";

import { onboardingTargetAttr } from "@/components/onboarding/target-attach";

export function OnboardingEmptyState({
  onAddSource,
  onAddOneTime,
}: {
  onAddSource: () => void;
  onAddOneTime: () => void;
}) {
  return (
    <section
      className="space-y-3 rounded-2xl border border-accent-yellow/50 bg-accent-yellow/10 p-4"
      {...onboardingTargetAttr("calendar-actions")}
    >
      <div>
        <h2 className="text-sm font-bold">Начните с источника дохода</h2>
        <p className="mt-1 text-xs text-muted">
          Добавьте ежедневные задания, еженедельные награды, пропуск, события или другое регулярное
          поступление.
        </p>
      </div>

      <button
        type="button"
        onClick={onAddSource}
        className="min-h-11 w-full rounded-xl bg-accent-yellow text-sm font-bold text-black"
      >
        + Добавить источник
      </button>
      <button
        type="button"
        onClick={onAddOneTime}
        className="min-h-11 w-full rounded-xl border border-border text-sm font-semibold"
      >
        Добавить разовое поступление
      </button>

      <p className="text-xs text-muted">
        После добавления источников будущие поступления появятся на календаре автоматически.
      </p>
    </section>
  );
}
