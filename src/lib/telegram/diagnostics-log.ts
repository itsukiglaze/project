"use client";

import type { AuthDiagnosticEvent } from "@/lib/validation/auth";

/**
 * Fire-and-forget report of how a launch/auth attempt went, to
 * POST /api/diagnostics/auth. Never throws, never blocks the caller —
 * diagnostics must never be able to affect the actual auth flow. The
 * payload shape (see AuthDiagnosticEvent) is privacy-safe by
 * construction: there is no field for initData/hash/token/user
 * payload/cookies, so nothing sensitive can be passed through here even
 * by mistake.
 */
export function reportAuthDiagnostic(event: AuthDiagnosticEvent): void {
  if (typeof fetch === "undefined") return;
  try {
    void fetch("/api/diagnostics/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Diagnostics must never throw into the caller.
  }
}
