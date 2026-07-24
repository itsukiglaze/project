"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getClientTimezone, getRawInitData, initTelegramWebApp } from "@/lib/telegram/webapp";

export interface CurrentUser {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  timezone: string;
}

type AuthStatus = "loading" | "authenticated" | "error";

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  errorCode: string | null;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  status: "loading",
  user: null,
  errorCode: null,
  retry: () => undefined,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

async function bootstrapSession(): Promise<CurrentUser> {
  initTelegramWebApp();

  const initData = getRawInitData();
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
    throw new Error(body?.error?.code ?? "AUTH_FAILED");
  }

  const meResponse = await fetch("/api/me", { credentials: "same-origin" });
  if (!meResponse.ok) {
    throw new Error("ME_FAILED");
  }

  return (await meResponse.json()) as CurrentUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    bootstrapSession()
      .then((currentUser) => {
        if (cancelled) return;
        setUser(currentUser);
        setStatus("authenticated");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorCode(err instanceof Error ? err.message : "AUTH_FAILED");
        setStatus("error");
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
      retry: () => {
        setStatus("loading");
        setErrorCode(null);
        setAttempt((n) => n + 1);
      },
    }),
    [status, user, errorCode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
