"use client";

import { useEffect, useRef, useState } from "react";
import { getClientTimezone } from "@/lib/telegram/webapp";

/**
 * Renders the official Telegram Login Widget
 * (https://core.telegram.org/widgets/login) as the secure fallback when
 * Mini App `initData` isn't available (ordinary browser, or a Telegram
 * client that never populates it). This is a SEPARATE, secondary auth
 * path with its own distinct server-side verification algorithm — see
 * lib/telegram/verify-login-widget.ts — never mixed with Mini App
 * initData, and never a bypass of Telegram's own cryptographic signature.
 *
 * Requires NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (public — a bot's @username
 * is not secret) and the bot's domain registered via BotFather /setdomain
 * (see DEVELOPMENT_STATUS.md's deployment checklist). Renders nothing if
 * that env var isn't set — the fallback is simply unavailable, the
 * primary Mini App path is entirely unaffected either way.
 */

interface RawTelegramLoginUser {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: RawTelegramLoginUser) => void;
  }
}

export type TelegramLoginWidgetStatus = "loading" | "ready" | "verifying" | "error";

export interface TelegramLoginWidgetProps {
  onAuthenticated: () => void;
  /** A coarse failure category — never raw secrets/tokens/hashes. */
  onError: (category: string) => void;
}

export function TelegramLoginWidget({ onAuthenticated, onError }: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<TelegramLoginWidgetStatus>("loading");
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  useEffect(() => {
    if (!botUsername) return;
    let cancelled = false;

    async function verify(rawUser: RawTelegramLoginUser, nonce: string) {
      setStatus("verifying");
      try {
        const response = await fetch("/api/auth/telegram-login/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            id: String(rawUser.id),
            first_name: rawUser.first_name,
            last_name: rawUser.last_name,
            username: rawUser.username,
            photo_url: rawUser.photo_url,
            auth_date: String(rawUser.auth_date),
            hash: rawUser.hash,
            nonce,
            timezone: getClientTimezone(),
          }),
        });
        if (cancelled) return;
        if (response.ok) {
          onAuthenticated();
        } else {
          const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
          setStatus("error");
          onError(body?.error?.code ?? "LOGIN_WIDGET_FAILED");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          onError("NETWORK_ERROR");
        }
      }
    }

    fetch("/api/auth/telegram-login/nonce", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("nonce fetch failed"))))
      .then((body: { nonce: string }) => {
        if (cancelled) return;

        window.onTelegramAuth = (rawUser) => {
          void verify(rawUser, body.nonce);
        };

        const script = document.createElement("script");
        script.src = "https://telegram.org/js/telegram-widget.js?22";
        script.async = true;
        script.setAttribute("data-telegram-login", botUsername);
        script.setAttribute("data-size", "large");
        script.setAttribute("data-radius", "12");
        script.setAttribute("data-onauth", "onTelegramAuth(user)");
        script.setAttribute("data-request-access", "write");
        containerRef.current?.appendChild(script);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          onError("NONCE_UNAVAILABLE");
        }
      });

    return () => {
      cancelled = true;
      delete window.onTelegramAuth;
    };
  }, [botUsername, onAuthenticated, onError]);

  if (!botUsername) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} data-testid="telegram-login-widget-container" />
      {status === "verifying" && <p className="text-sm text-muted">Проверяем вход…</p>}
    </div>
  );
}
