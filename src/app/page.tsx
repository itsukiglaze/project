"use client";

import { useAuth } from "@/components/providers/auth-provider";

const ERROR_MESSAGES: Record<string, string> = {
  SIGNATURE_MISMATCH: "Не удалось подтвердить подлинность запуска из Telegram.",
  EXPIRED: "Сессия запуска устарела. Попробуйте перезапустить Mini App.",
  MISSING_INIT_DATA: "Приложение нужно открыть через Telegram.",
  SERVER_MISCONFIGURED: "Сервер временно недоступен. Попробуйте позже.",
};

function HomeSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4 pt-6">
      <div className="h-6 w-40 rounded bg-border" />
      <div className="h-28 rounded-2xl bg-border" />
      <div className="h-40 rounded-2xl bg-border" />
    </div>
  );
}

function HomeError({ code, onRetry }: { code: string | null; onRetry: () => void }) {
  const message = (code && ERROR_MESSAGES[code]) || "Не удалось войти. Попробуйте ещё раз.";
  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-24 text-center">
      <div className="h-16 w-16 rounded-2xl bg-accent-red/10" />
      <h1 className="text-lg font-bold">Не удалось войти</h1>
      <p className="max-w-xs text-sm text-muted">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-xl bg-surface-contrast px-5 py-2.5 text-sm font-semibold text-background"
      >
        Повторить
      </button>
    </div>
  );
}

export default function HomePage() {
  const { status, user, errorCode, retry } = useAuth();

  if (status === "loading") return <HomeSkeleton />;
  if (status === "error") return <HomeError code={errorCode} onRetry={retry} />;

  const displayName = user?.firstName || user?.username || "проксёр";

  return (
    <div className="space-y-4 p-4 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">С возвращением,</p>
          <h1 className="text-2xl font-bold">{displayName}</h1>
        </div>
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-contrast text-background">
          <span className="text-lg font-bold">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className="absolute -bottom-1 -left-1 h-3 w-3 -rotate-12 rounded-[3px] bg-accent-yellow" />
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Часовой пояс</p>
        <p className="mt-1 text-lg font-semibold">{user?.timezone}</p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">
          Аккаунт создан и данные будут сохраняться между входами. Калькулятор круток,
          календарь и статистика появятся на следующих этапах.
        </p>
      </section>
    </div>
  );
}
