"use client";

import { useAuth, type AuthFailureCategory } from "@/components/providers/auth-provider";
import { TelegramLoginWidget } from "@/components/auth/telegram-login-widget";

const ERROR_MESSAGES: Record<string, string> = {
  SIGNATURE_MISMATCH: "Не удалось подтвердить подлинность запуска из Telegram.",
  EXPIRED: "Сессия запуска устарела. Попробуйте перезапустить Mini App.",
  MISSING_INIT_DATA: "Приложение нужно открыть через Telegram.",
  SERVER_MISCONFIGURED: "Сервер временно недоступен. Попробуйте позже.",
};

/**
 * Required exact message (localized — the rest of this app's UI is
 * Russian throughout): "This Telegram client did not provide secure
 * authorization data. Open the app in the official Telegram client or
 * use secure web login."
 */
const EMPTY_INIT_DATA_MESSAGE =
  "Этот клиент Telegram не передал безопасные данные авторизации. Откройте приложение в официальном клиенте Telegram или используйте безопасный вход через браузер.";

function HomeSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4 pt-6">
      <div className="h-6 w-40 rounded bg-border" />
      <div className="h-28 rounded-2xl bg-border" />
      <div className="h-40 rounded-2xl bg-border" />
    </div>
  );
}

/** Fallback login is only offered when it can plausibly help: WebApp missing, or present-but-empty initData. Never for a rejected/expired signature or a backend failure — those aren't fixed by logging in a second way. */
function showsLoginWidgetFallback(category: AuthFailureCategory | null): boolean {
  return category === "EMPTY_INIT_DATA" || category === "NO_TELEGRAM";
}

function HomeError({
  code,
  category,
  onRetry,
  onLoginWidgetAuthenticated,
}: {
  code: string | null;
  category: AuthFailureCategory | null;
  onRetry: () => void;
  onLoginWidgetAuthenticated: () => void;
}) {
  const message =
    category === "EMPTY_INIT_DATA"
      ? EMPTY_INIT_DATA_MESSAGE
      : (code && ERROR_MESSAGES[code]) || "Не удалось войти. Попробуйте ещё раз.";

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
      {showsLoginWidgetFallback(category) && (
        <div className="mt-2 flex flex-col items-center gap-2 border-t border-border pt-4">
          <p className="text-xs text-muted">Или войдите через браузер:</p>
          <TelegramLoginWidget
            onAuthenticated={onLoginWidgetAuthenticated}
            onError={() => undefined}
          />
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const { status, user, errorCode, authFailureCategory, retry, completeLoginWidgetAuth } = useAuth();

  if (status === "loading") return <HomeSkeleton />;
  if (status === "error") {
    return (
      <HomeError
        code={errorCode}
        category={authFailureCategory}
        onRetry={retry}
        onLoginWidgetAuthenticated={completeLoginWidgetAuth}
      />
    );
  }

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
