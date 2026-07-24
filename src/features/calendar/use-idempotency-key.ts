"use client";

import { useRef } from "react";

/**
 * Tracks the idempotency key for one user action (e.g. one form's submit
 * button). Calling `getKey(payload)` again with the SAME (deep-equal via
 * JSON) payload returns the same key — the correct behavior for a retry.
 * Calling it with a DIFFERENT payload (the user changed something) mints a
 * fresh key, since that's a new request, not a retry of the old one.
 */
export function useIdempotencyKey() {
  const lastPayloadRef = useRef<string | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  function getKey(payload: unknown): string {
    const serialized = JSON.stringify(payload);
    if (lastKeyRef.current && lastPayloadRef.current === serialized) {
      return lastKeyRef.current;
    }
    const key = crypto.randomUUID();
    lastKeyRef.current = key;
    lastPayloadRef.current = serialized;
    return key;
  }

  /** Called after a successful mutation so the NEXT action starts fresh. */
  function reset(): void {
    lastKeyRef.current = null;
    lastPayloadRef.current = null;
  }

  return { getKey, reset };
}
