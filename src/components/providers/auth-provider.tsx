"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getClientTimezone,
  initTelegramWebApp,
  waitForTelegramLaunch,
  type TelegramLaunchState,
} from "@/lib/telegram/webapp";
import { snapshotTelegramEnvironment } from "@/lib/telegram/diagnostics";
import { reportAuthDiagnostic } from "@/lib/telegram/diagnostics-log";

export interface CurrentUser {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  timezone: string;
  /** `null` means the user has never completed or skipped any onboarding version yet. */
  onboardingVersion: number | null;
  onboardingOutcome: "COMPLETED" | "SKIPPED" | null;
}

type AuthStatus = "loading" | "authenticated" | "error";

/** Coarser than the raw server error code — what the UI actually branches on. */
export type AuthFailureCategory =
  /** Telegram `WebApp` was present, but `initData` never became non-empty (the AyuGram symptom this whole feature exists for). */
  | "EMPTY_INIT_DATA"
  /** `WebApp` never appeared at all, and the server confirms no initData was sent — an ordinary browser. */
  | "NO_TELEGRAM"
  /** `initData` was sent but the server's cryptographic check rejected it (bad/stale/tampered). */
  | "INIT_DATA_REJECTED"
  /** The server itself isn't configured correctly (e.g. missing TELEGRAM_BOT_TOKEN) — not the client's fault. */
  | "SERVER_MISCONFIGURED"
  /** Network failure, 500, or anything else not cleanly attributable to the above. */
  | "BACKEND_ERROR";

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  errorCode: string | null;
  authFailureCategory: AuthFailureCategory | null;
  launchPath: TelegramLaunchState["kind"] | null;
  retry: () => void;
  /** Called by the Telegram Login Widget fallback once its own server-side verify has already set the session cookie — just re-reads /api/me, does not re-run the Mini App bootstrap. */
  completeLoginWidgetAuth: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  status: "loading",
  user: null,
  errorCode: null,
  authFailureCategory: null,
  launchPath: null,
  retry: () => undefined,
  completeLoginWidgetAuth: () => undefined,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

class BootstrapError extends Error {
  constructor(
    message: string,
    public readonly category: AuthFailureCategory,
  ) {
    super(message);
    this.name = "BootstrapError";
  }
}

function categorizeServerErrorCode(code: string): AuthFailureCategory {
  switch (code) {
    case "MISSING_INIT_DATA":
      return "NO_TELEGRAM";
    case "MALFORMED":
    case "MISSING_HASH":
    case "MISSING_AUTH_DATE":
    case "MISSING_USER":
    case "INVALID_AUTH_DATE":
    case "EXPIRED":
    case "SIGNATURE_MISMATCH":
      return "INIT_DATA_REJECTED";
    case "SERVER_MISCONFIGURED":
      return "SERVER_MISCONFIGURED";
    default:
      return "BACKEND_ERROR";
  }
}

async function fetchCurrentUser(): Promise<CurrentUser> {
  const meResponse = await fetch("/api/me", { credentials: "same-origin" });
  if (!meResponse.ok) {
    throw new BootstrapError("ME_FAILED", "BACKEND_ERROR");
  }
  return (await meResponse.json()) as CurrentUser;
}

/**
 * Resolves the Telegram launch state (bounded wait — see
 * waitForTelegramLaunch), then authenticates. `EMPTY_INIT_DATA` is
 * short-circuited client-side without a server round trip: the server
 * cannot tell "WebApp present but empty" apart from "no WebApp at all"
 * (both send the same empty string), and the client already has the more
 * specific answer from the bounded wait.
 */
async function bootstrapSession(): Promise<{ user: CurrentUser; launchState: TelegramLaunchState }> {
  initTelegramWebApp();
  const launchState = await waitForTelegramLaunch();

  if (launchState.kind === "webapp_empty_init_data") {
    throw new BootstrapError("EMPTY_INIT_DATA", "EMPTY_INIT_DATA");
  }

  const initData = launchState.kind === "webapp" ? launchState.initData : "";
  const timezone = getClientTimezone();

  const authResponse = await fetch("/api/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ initData, timezone }),
  });

  if (!authResponse.ok) {
    const body = (await authResponse.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    const code = body?.error?.code ?? "AUTH_FAILED";
    throw new BootstrapError(code, categorizeServerErrorCode(code));
  }

  const user = await fetchCurrentUser();
  return { user, launchState };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [authFailureCategory, setAuthFailureCategory] = useState<AuthFailureCategory | null>(null);
  const [launchPath, setLaunchPath] = useState<TelegramLaunchState["kind"] | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    bootstrapSession()
      .then(({ user: currentUser, launchState }) => {
        if (cancelled) return;
        setUser(currentUser);
        setLaunchPath(launchState.kind);
        setStatus("authenticated");
        const env = snapshotTelegramEnvironment();
        reportAuthDiagnostic({
          platform: env.platform,
          webAppVersion: env.version,
          initDataPresent: env.initDataPresent,
          launchPath: launchState.kind,
          authFailureCategory: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const code = err instanceof Error ? err.message : "AUTH_FAILED";
        const category = err instanceof BootstrapError ? err.category : "BACKEND_ERROR";
        setErrorCode(code);
        setAuthFailureCategory(category);
        setStatus("error");
        const env = snapshotTelegramEnvironment();
        setLaunchPath(env.webAppPresent ? (env.initDataPresent ? "webapp" : "webapp_empty_init_data") : "no_webapp");
        reportAuthDiagnostic({
          platform: env.platform,
          webAppVersion: env.version,
          initDataPresent: env.initDataPresent,
          launchPath: env.webAppPresent
            ? env.initDataPresent
              ? "webapp"
              : "webapp_empty_init_data"
            : "no_webapp",
          authFailureCategory: category,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      errorCode,
      authFailureCategory,
      launchPath,
      retry: () => {
        setStatus("loading");
        setErrorCode(null);
        setAuthFailureCategory(null);
        setAttempt((n) => n + 1);
      },
      completeLoginWidgetAuth: () => {
        setStatus("loading");
        setErrorCode(null);
        setAuthFailureCategory(null);
        fetchCurrentUser()
          .then((currentUser) => {
            setUser(currentUser);
            setLaunchPath("no_webapp");
            setStatus("authenticated");
            reportAuthDiagnostic({
              platform: null,
              webAppVersion: null,
              initDataPresent: false,
              launchPath: "login_widget",
              authFailureCategory: null,
            });
          })
          .catch(() => {
            setErrorCode("ME_FAILED");
            setAuthFailureCategory("BACKEND_ERROR");
            setStatus("error");
          });
      },
    }),
    [status, user, errorCode, authFailureCategory, launchPath],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
