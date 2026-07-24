import { ResourceForm } from "@/features/profile/resource-form";
import { PityForm } from "@/features/profile/pity-form";

export default function SettingsPage() {
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
    </div>
  );
}
