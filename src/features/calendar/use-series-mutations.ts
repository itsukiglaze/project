"use client";

import { useState } from "react";
import type { LocalDate } from "@/lib/calendar-math";
import {
  createSeries,
  deleteSeries,
  splitSeries,
  updateSeries,
  type RecurrenceRuleDto,
  type SeriesMutationResult,
  type SeriesTemplateDto,
  type SplitMutationResult,
} from "./api";
import { mapMutationError, type MutationState } from "./mutation-state";
import { useIdempotencyKey } from "./use-idempotency-key";
import { invalidateQueryKeys } from "@/lib/query/query-cache";
import { CALENDAR_QUERY_KEYS } from "./query-cache";

function invalidateAfterSeriesChange(): void {
  invalidateQueryKeys(CALENDAR_QUERY_KEYS.seriesList);
  invalidateQueryKeys(CALENDAR_QUERY_KEYS.occurrencesPrefix);
  invalidateQueryKeys(CALENDAR_QUERY_KEYS.forecastPrefix);
}

export function useSeriesMutations() {
  const [state, setState] = useState<MutationState>({ status: "idle" });
  const createKey = useIdempotencyKey();
  const updateKey = useIdempotencyKey();
  const deleteKey = useIdempotencyKey();
  const splitKey = useIdempotencyKey();

  async function create(
    template: SeriesTemplateDto,
    rule: RecurrenceRuleDto,
    timezone: string,
  ): Promise<SeriesMutationResult | null> {
    setState({ status: "loading" });
    const key = createKey.getKey({ template, rule, timezone });
    const result = await createSeries(template, rule, timezone, key);
    if (result.status === "success") {
      createKey.reset();
      setState({ status: "success" });
      invalidateAfterSeriesChange();
      return result.data;
    }
    setState(mapMutationError(result));
    return null;
  }

  /** Edits the ENTIRE series in place — never touches past materialized history. */
  async function update(
    seriesId: string,
    template: SeriesTemplateDto,
    rule: RecurrenceRuleDto,
    expectedVersion: number,
  ): Promise<SeriesMutationResult | null> {
    setState({ status: "loading" });
    const key = updateKey.getKey({ seriesId, template, rule, expectedVersion });
    const result = await updateSeries(seriesId, template, rule, expectedVersion, key);
    if (result.status === "success") {
      updateKey.reset();
      setState({ status: "success" });
      invalidateAfterSeriesChange();
      return result.data;
    }
    setState(mapMutationError(result));
    return null;
  }

  async function remove(seriesId: string, expectedVersion: number): Promise<SeriesMutationResult | null> {
    setState({ status: "loading" });
    const key = deleteKey.getKey({ seriesId, expectedVersion });
    const result = await deleteSeries(seriesId, expectedVersion, key);
    if (result.status === "success") {
      deleteKey.reset();
      setState({ status: "success" });
      invalidateAfterSeriesChange();
      return result.data;
    }
    setState(mapMutationError(result));
    return null;
  }

  /** "This and future occurrences" — delegates entirely to the split endpoint. */
  async function split(
    seriesId: string,
    template: SeriesTemplateDto,
    rule: RecurrenceRuleDto,
    splitDate: LocalDate,
    expectedVersion: number,
  ): Promise<SplitMutationResult | null> {
    setState({ status: "loading" });
    const key = splitKey.getKey({ seriesId, template, rule, splitDate, expectedVersion });
    const result = await splitSeries(seriesId, template, rule, splitDate, expectedVersion, key);
    if (result.status === "success") {
      splitKey.reset();
      setState({ status: "success" });
      invalidateAfterSeriesChange();
      return result.data;
    }
    setState(mapMutationError(result));
    return null;
  }

  return {
    state,
    create,
    update,
    remove,
    split,
    resetState: () => setState({ status: "idle" }),
  };
}
