"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { triggerHapticImpact, triggerHapticNotification } from "@/lib/telegram/webapp";
import { submitCalculatorRequest } from "./api";
import {
  buildCalculatorRequestPayload,
  computeRequestSignature,
  getClientFieldErrors,
  hasClientFieldErrors,
} from "./build-request";
import {
  createDefaultCalculatorFormState,
  type BannerStateFieldsState,
  type CalculatorFormState,
  type CalculatorUiState,
  type FamilyFormState,
  type ResourceFieldsState,
} from "./types";

export function useCalculatorForm() {
  const [activeFamily, setActiveFamilyState] = useState<BannerFamily>(BannerFamily.EXCLUSIVE_AGENT);
  const [formState, setFormState] = useState<CalculatorFormState>(createDefaultCalculatorFormState);
  const [uiState, setUiState] = useState<CalculatorUiState>({ status: "idle" });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isSubmittingRef = useRef(false);
  const lastSubmittedSignatureRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  /**
   * Monotonically-increasing id for the "current" request. Belt-and-suspenders
   * alongside AbortController: even in an edge case where an aborted
   * fetch's promise still settles instead of rejecting, a stale response
   * can never overwrite a newer one because its captured id no longer
   * matches by the time it resolves.
   */
  const requestSequenceRef = useRef(0);

  const activeState = formState[activeFamily];
  const config = getBannerConfig(activeFamily);

  const clientFieldErrors = useMemo(
    () => getClientFieldErrors(activeFamily, activeState, config),
    [activeFamily, activeState, config],
  );

  const currentSignature = useMemo(
    () => computeRequestSignature(activeFamily, activeState),
    [activeFamily, activeState],
  );

  // Mark a previously-successful result stale the moment anything it
  // depended on changes — never show a stale number as current.
  useEffect(() => {
    if (
      (uiState.status === "calculated" || uiState.status === "unsupported") &&
      !uiState.stale &&
      lastSubmittedSignatureRef.current !== null &&
      lastSubmittedSignatureRef.current !== currentSignature
    ) {
      setUiState((prev) =>
        prev.status === "calculated" || prev.status === "unsupported"
          ? { ...prev, stale: true }
          : prev,
      );
    }
  }, [currentSignature, uiState]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const setActiveFamily = useCallback((family: BannerFamily) => {
    setActiveFamilyState(family);
  }, []);

  const updateFamilyState = useCallback(
    (family: BannerFamily, updater: (prev: FamilyFormState) => FamilyFormState) => {
      setFormState((prev) => ({ ...prev, [family]: updater(prev[family]) }));
    },
    [],
  );

  const updateResourceField = useCallback(
    (field: keyof Omit<ResourceFieldsState, "includeMonochrome">, value: string) => {
      updateFamilyState(activeFamily, (prev) => ({
        ...prev,
        resources: { ...prev.resources, [field]: value },
      }));
    },
    [activeFamily, updateFamilyState],
  );

  const toggleIncludeMonochrome = useCallback(() => {
    updateFamilyState(activeFamily, (prev) => ({
      ...prev,
      resources: { ...prev.resources, includeMonochrome: !prev.resources.includeMonochrome },
    }));
  }, [activeFamily, updateFamilyState]);

  const updateBannerStateField = useCallback(
    (field: keyof Omit<BannerStateFieldsState, "guaranteeActive">, value: string) => {
      updateFamilyState(activeFamily, (prev) => ({
        ...prev,
        bannerState: { ...prev.bannerState, [field]: value },
      }));
    },
    [activeFamily, updateFamilyState],
  );

  const toggleGuaranteeActive = useCallback(() => {
    updateFamilyState(activeFamily, (prev) => ({
      ...prev,
      bannerState: { ...prev.bannerState, guaranteeActive: !prev.bannerState.guaranteeActive },
    }));
  }, [activeFamily, updateFamilyState]);

  const updateTargetCopies = useCallback(
    (value: string) => {
      updateFamilyState(activeFamily, (prev) => ({ ...prev, targetCopies: value }));
    },
    [activeFamily, updateFamilyState],
  );

  const setUseSavedResources = useCallback(
    (useSaved: boolean) => {
      updateFamilyState(activeFamily, (prev) => ({ ...prev, useSavedResources: useSaved }));
    },
    [activeFamily, updateFamilyState],
  );

  const setUseSavedBannerState = useCallback(
    (useSaved: boolean) => {
      updateFamilyState(activeFamily, (prev) => ({ ...prev, useSavedBannerState: useSaved }));
    },
    [activeFamily, updateFamilyState],
  );

  const submit = useCallback(async () => {
    if (isSubmittingRef.current) return; // prevent double-submit
    if (hasClientFieldErrors(clientFieldErrors)) return;

    isSubmittingRef.current = true;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const thisRequestId = ++requestSequenceRef.current;

    setUiState({ status: "loading" });

    const payload = buildCalculatorRequestPayload(activeFamily, activeState, config);
    const signatureAtSubmitTime = currentSignature;

    try {
      const result = await submitCalculatorRequest(payload, controller.signal);

      // Stale-response guards, checked before touching any state:
      //  - aborted: a newer submit() (or unmount) cancelled this one.
      //  - unmounted: never setState after the component is gone.
      //  - superseded: this id is no longer the latest request, even if
      //    (in some edge case) the abort didn't actually reject the fetch.
      if (result.status === "aborted") return;
      if (!isMountedRef.current) return;
      if (thisRequestId !== requestSequenceRef.current) return;

      if (result.status === "success") {
        lastSubmittedSignatureRef.current = signatureAtSubmitTime;
        if (result.data.kind === "CALCULATED") {
          setUiState({ status: "calculated", data: result.data, stale: false });
          triggerHapticNotification("success");
        } else {
          setUiState({ status: "unsupported", data: result.data, stale: false });
          triggerHapticImpact("light");
        }
        return;
      }

      if (result.status === "validation_error") {
        setUiState({
          status: "validation_error",
          message: result.message,
          fieldErrors: result.fieldErrors,
        });
        triggerHapticNotification("error");
        return;
      }

      if (result.status === "auth_error") {
        setUiState({ status: "auth_error", message: result.message });
        triggerHapticNotification("error");
        return;
      }

      if (result.status === "network_error") {
        setUiState({ status: "network_error" });
        triggerHapticNotification("error");
        return;
      }

      setUiState({ status: "unknown_error", message: result.message });
      triggerHapticNotification("error");
    } finally {
      // Always reset, regardless of which branch above returned — a
      // request that ends up aborted/superseded must not leave the form
      // stuck thinking a submission is still in flight.
      isSubmittingRef.current = false;
    }
  }, [activeFamily, activeState, clientFieldErrors, config, currentSignature]);

  const isSubmitting = uiState.status === "loading";

  return {
    activeFamily,
    setActiveFamily,
    config,
    formState: activeState,
    clientFieldErrors,
    uiState,
    isSubmitting,
    canSubmit: !isSubmitting && !hasClientFieldErrors(clientFieldErrors),
    updateResourceField,
    toggleIncludeMonochrome,
    updateBannerStateField,
    toggleGuaranteeActive,
    updateTargetCopies,
    setUseSavedResources,
    setUseSavedBannerState,
    submit,
  };
}
