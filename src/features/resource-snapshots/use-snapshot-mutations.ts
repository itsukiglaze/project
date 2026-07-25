"use client";

import { useState } from "react";
import type { LocalDate } from "@/lib/calendar-math";
import {
  deleteSnapshot,
  saveSnapshot,
  type DeleteSnapshotResult,
  type SaveSnapshotInput,
  type SnapshotMutationResult,
} from "./api";
import { mapMutationError, type MutationState } from "./mutation-state";
import { useIdempotencyKey } from "@/features/calendar/use-idempotency-key";
import { invalidateQueryKeys } from "@/lib/query/query-cache";
import { RESOURCE_SNAPSHOT_QUERY_KEYS } from "./query-cache";

function invalidateAfterSnapshotChange(): void {
  invalidateQueryKeys(RESOURCE_SNAPSHOT_QUERY_KEYS.latest);
  invalidateQueryKeys(RESOURCE_SNAPSHOT_QUERY_KEYS.historyPrefix);
}

export function useSnapshotMutations() {
  const [state, setState] = useState<MutationState>({ status: "idle" });
  const saveKey = useIdempotencyKey();
  const deleteKey = useIdempotencyKey();

  async function save(
    date: LocalDate,
    input: SaveSnapshotInput,
    expectedVersion: number,
  ): Promise<SnapshotMutationResult | null> {
    setState({ status: "loading" });
    const key = saveKey.getKey({ date, input, expectedVersion });
    const result = await saveSnapshot(date, input, expectedVersion, key);
    if (result.status === "success") {
      saveKey.reset();
      setState({ status: "success" });
      invalidateAfterSnapshotChange();
      return result.data;
    }
    setState(mapMutationError(result));
    return null;
  }

  async function remove(date: LocalDate, expectedVersion: number): Promise<DeleteSnapshotResult | null> {
    setState({ status: "loading" });
    const key = deleteKey.getKey({ date, expectedVersion });
    const result = await deleteSnapshot(date, expectedVersion, key);
    if (result.status === "success") {
      deleteKey.reset();
      setState({ status: "success" });
      invalidateAfterSnapshotChange();
      return result.data;
    }
    setState(mapMutationError(result));
    return null;
  }

  return { state, save, remove, resetState: () => setState({ status: "idle" }) };
}
