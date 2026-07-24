"use client";

import { useState } from "react";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
  type TransactionInputDto,
  type TransactionMutationResult,
} from "./api";
import { mapMutationError, type MutationState } from "./mutation-state";
import { useIdempotencyKey } from "./use-idempotency-key";
import { CALENDAR_QUERY_KEYS, invalidateQueryKeys } from "./query-cache";

function invalidateAfterTransactionChange(): void {
  invalidateQueryKeys(CALENDAR_QUERY_KEYS.occurrencesPrefix);
  invalidateQueryKeys(CALENDAR_QUERY_KEYS.forecastPrefix);
}

export function useTransactionMutations() {
  const [state, setState] = useState<MutationState>({ status: "idle" });
  const createKey = useIdempotencyKey();
  const updateKey = useIdempotencyKey();
  const deleteKey = useIdempotencyKey();

  async function create(input: TransactionInputDto): Promise<TransactionMutationResult | null> {
    setState({ status: "loading" });
    const key = createKey.getKey(input);
    const result = await createTransaction(input, key);
    if (result.status === "success") {
      createKey.reset();
      setState({ status: "success" });
      invalidateAfterTransactionChange();
      return result.data;
    }
    setState(mapMutationError(result));
    return null;
  }

  async function update(
    transactionId: string,
    input: TransactionInputDto,
    expectedVersion: number,
  ): Promise<TransactionMutationResult | null> {
    setState({ status: "loading" });
    const key = updateKey.getKey({ transactionId, input, expectedVersion });
    const result = await updateTransaction(transactionId, input, expectedVersion, key);
    if (result.status === "success") {
      updateKey.reset();
      setState({ status: "success" });
      invalidateAfterTransactionChange();
      return result.data;
    }
    setState(mapMutationError(result));
    return null;
  }

  async function remove(
    transactionId: string,
    expectedVersion: number,
  ): Promise<TransactionMutationResult | null> {
    setState({ status: "loading" });
    const key = deleteKey.getKey({ transactionId, expectedVersion });
    const result = await deleteTransaction(transactionId, expectedVersion, key);
    if (result.status === "success") {
      deleteKey.reset();
      setState({ status: "success" });
      invalidateAfterTransactionChange();
      return result.data;
    }
    setState(mapMutationError(result));
    return null;
  }

  return { state, create, update, remove, resetState: () => setState({ status: "idle" }) };
}
