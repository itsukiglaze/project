"use client";

import { ResourceForm } from "@/features/profile/resource-form";
import { PityForm } from "@/features/profile/pity-form";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";

export default function SettingsPage() {
  const { start } = useOnboarding();

  return (
    <div className="space-y-4 p-4 pt-6">
      <header>
        <h1 className="text-xl font-bold">Настройки</h1>
        <p className="text-xs text-muted">
          Ручное сохранение ресурсов и pity в профиле. Перед сохранением можно посмотреть, что
          именно изменится.
        </p>
      </header>

      <ResourceForm />
      <PityForm />

      <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">Помощь</h2>
        <p className="text-xs text-muted">Интерактивный обзор основных функций.</p>
        <button
          type="button"
          onClick={() => start("manual")}
          className="min-h-11 w-full rounded-xl border border-border text-sm font-semibold"
        >
          Пройти обучение заново
        </button>
      </section>
    </div>
  );
}
