"use client";

import { useEffect, useRef, useState } from "react";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { computeFieldDiff, hasAnyChange, type FieldChange } from "@/lib/diff";
import { parsePity } from "@/features/calculator/field-validation";
import { fetchAllBannerStates, saveBannerStateSnapshot, type BannerStateSnapshot } from "./api";

type DraftFields = {
  sRankPity: string;
  aRankPity: string;
  guaranteeActive: boolean;
};

type Phase =
  | "loading"
  | "load_error"
  | "editing"
  | "previewing"
  | "saving"
  | "saved"
  | "save_error"
  | "conflict";

const ZERO_STATE: BannerStateSnapshot = { sRankPity: 0, aRankPity: 0, guaranteeActive: false };

function snapshotToDraft(snapshot: BannerStateSnapshot): DraftFields {
  return {
    sRankPity: String(snapshot.sRankPity),
    aRankPity: String(snapshot.aRankPity),
    guaranteeActive: snapshot.guaranteeActive,
  };
}

export function usePityForm(family: BannerFamily) {
  const config = getBannerConfig(family);
  const [baseline, setBaseline] = useState<BannerStateSnapshot | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [draft, setDraft] = useState<DraftFields>(snapshotToDraft(ZERO_STATE));
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<string>("");
  const [previewChanges, setPreviewChanges] = useState<FieldChange<BannerStateSnapshot>[]>([]);

  const idempotencyKeyRef = useRef<string | null>(null);
  const idempotencyPayloadRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAllBannerStates().then((result) => {
      if (cancelled) return;
      if (result.status === "success") {
        const entry = result.data.bannerStates.find((s) => s.family === family) ?? {
          family,
          ...ZERO_STATE,
          version: 0,
        };
        const snapshot: BannerStateSnapshot = {
          sRankPity: entry.sRankPity,
          aRankPity: entry.aRankPity,
          guaranteeActive: entry.guaranteeActive,
        };
        setBaseline(snapshot);
        setVersion(entry.version);
        setDraft(snapshotToDraft(snapshot));
        setPhase("editing");
      } else {
        setMessage(result.status === "network_error" ? "Нет соединения." : "message" in result ? result.message : "Не удалось загрузить данные.");
        setPhase("load_error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [family]);

  const fieldErrors: Record<string, string> = {};
  const sRank = parsePity(draft.sRankPity, config.hardPityS);
  if (!sRank.ok) fieldErrors.sRankPity = sRank.error;
  const aRank = parsePity(draft.aRankPity, config.hardPityA);
  if (!aRank.ok) fieldErrors.aRankPity = aRank.error;
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  const draftToSnapshot = (): BannerStateSnapshot => ({
    sRankPity: Number(draft.sRankPity),
    aRankPity: Number(draft.aRankPity),
    guaranteeActive: draft.guaranteeActive,
  });

  const isDirty = baseline !== null && !hasFieldErrors && hasAnyChange(baseline, draftToSnapshot());

  const updateField = (field: "sRankPity" | "aRankPity", value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setPhase((prev) =>
      prev === "previewing" || prev === "saved" || prev === "save_error" ? "editing" : prev,
    );
  };

  const toggleGuarantee = () => {
    setDraft((prev) => ({ ...prev, guaranteeActive: !prev.guaranteeActive }));
    setPhase((prev) =>
      prev === "previewing" || prev === "saved" || prev === "save_error" ? "editing" : prev,
    );
  };

  function keyForCurrentPayload(payload: BannerStateSnapshot): string {
    const serialized = JSON.stringify(payload);
    if (idempotencyKeyRef.current && idempotencyPayloadRef.current === serialized) {
      return idempotencyKeyRef.current;
    }
    const key = crypto.randomUUID();
    idempotencyKeyRef.current = key;
    idempotencyPayloadRef.current = serialized;
    return key;
  }

  const openPreview = () => {
    if (hasFieldErrors || !baseline) return;
    const next = draftToSnapshot();
    const changes = computeFieldDiff(baseline, next);
    keyForCurrentPayload(next);
    setPreviewChanges(changes);
    setPhase("previewing");
  };

  const cancelPreview = () => setPhase("editing");

  const reloadAfterConflict = async () => {
    setPhase("loading");
    const result = await fetchAllBannerStates();
    if (!isMountedRef.current) return;
    if (result.status === "success") {
      const entry = result.data.bannerStates.find((s) => s.family === family) ?? {
        family,
        ...ZERO_STATE,
        version: 0,
      };
      const snapshot: BannerStateSnapshot = {
        sRankPity: entry.sRankPity,
        aRankPity: entry.aRankPity,
        guaranteeActive: entry.guaranteeActive,
      };
      setBaseline(snapshot);
      setVersion(entry.version);
      setDraft(snapshotToDraft(snapshot));
      idempotencyKeyRef.current = null;
      idempotencyPayloadRef.current = null;
      setPhase("editing");
    } else {
      setMessage("Не удалось обновить данные после конфликта.");
      setPhase("load_error");
    }
  };

  const confirmSave = async () => {
    if (phase !== "previewing" && phase !== "save_error") return;
    if (!baseline) return;

    const next = draftToSnapshot();
    const key = keyForCurrentPayload(next);
    setPhase("saving");

    const result = await saveBannerStateSnapshot(family, next, version, key);
    if (!isMountedRef.current) return;

    if (result.status === "success") {
      setBaseline(result.data.updated);
      setVersion(result.data.version);
      setDraft(snapshotToDraft(result.data.updated));
      idempotencyKeyRef.current = null;
      idempotencyPayloadRef.current = null;
      setPhase("saved");
      return;
    }

    if (result.status === "conflict") {
      setMessage(
        "Данные были изменены в другом месте (например, в другой вкладке). Загружаем актуальное состояние — просмотрите изменения ещё раз.",
      );
      setPhase("conflict");
      return;
    }

    setMessage(result.status === "network_error" ? "Нет соединения — попробуйте ещё раз." : result.message);
    setPhase("save_error");
  };

  return {
    config,
    phase,
    message,
    draft,
    previewChanges,
    fieldErrors,
    isDirty,
    updateField,
    toggleGuarantee,
    openPreview,
    cancelPreview,
    confirmSave,
    reloadAfterConflict,
    canOpenPreview: phase === "editing" && !hasFieldErrors,
  };
}
