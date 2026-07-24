"use client";

import { useState } from "react";
import type { LocalDate } from "@/lib/calendar-math";
import { upsertException, type ExceptionInputDto, type ExceptionMutationResult } from "./api";
import { mapMutationError, type MutationState } from "./mutation-state";
import { useIdempotencyKey } from "./use-idempotency-key";
import { CALENDAR_QUERY_KEYS, invalidateQueryKeys } from "./query-cache";

export function useExceptionMutation() {
  const [state, setState] = useState<MutationState>({ status: "idle" });
  const key = useIdempotencyKey();

  /**
   * `expectedVersion` passed in by callers is often just a guess (0,
   * meaning "I believe no exception exists yet for this occurrence") —
   * the occurrences list endpoint doesn't expose a per-exception version,
   * so there's no way to know the real one in advance. If that guess is
   * wrong (an exception already exists, e.g. cancelling after a prior
   * amount override), the server tells us the true current version via
   * the STALE_STATE conflict's `current.version` — we use that to retry
   * automatically ONCE, rather than surfacing a confusing conflict for a
   * version number the user never chose or saw.
   *
   * The idempotency key is derived ONLY from what the user is actually
   * trying to do (seriesId/date/input) — deliberately NOT from
   * `expectedVersion`, which is a concurrency-control detail, not part of
   * the action's identity. That means both the initial guess and the
   * auto-corrected retry share the exact same key: the server never
   * records an idempotency entry for a STALE_STATE response (only for a
   * successful write), so replaying the same key with a corrected version
   * is safe and cannot collide with anything the first attempt left behind.
   *
   * If the retry itself ALSO comes back as a conflict (a second,
   * independent race), it is NOT retried again and NOT hidden — it
   * becomes the final result surfaced to the UI, same as any other error.
   */
  async function upsert(
    seriesId: string,
    occurrenceDate: LocalDate,
    input: ExceptionInputDto,
    expectedVersion: number,
  ): Promise<ExceptionMutationResult | null> {
    setState({ status: "loading" });

    const idempotencyKey = key.getKey({ seriesId, occurrenceDate, input });

    let result = await upsertException(seriesId, occurrenceDate, input, expectedVersion, idempotencyKey);

    if (result.status === "stale_state" && expectedVersion === 0) {
      const current = result.current as { version?: number } | undefined;
      if (typeof current?.version === "number") {
        result = await upsertException(
          seriesId,
          occurrenceDate,
          input,
          current.version,
          idempotencyKey,
        );
      }
    }

    if (result.status === "success") {
      key.reset();
      setState({ status: "success" });
      invalidateQueryKeys(CALENDAR_QUERY_KEYS.occurrencesPrefix);
      invalidateQueryKeys(CALENDAR_QUERY_KEYS.forecastPrefix);
      return result.data;
    }
    setState(mapMutationError(result));
    return null;
  }

  return { state, upsert, resetState: () => setState({ status: "idle" }) };
}
