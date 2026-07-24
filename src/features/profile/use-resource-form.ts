"use client";

import { useEffect, useRef, useState } from "react";
import { computeFieldDiff, hasAnyChange, type FieldChange } from "@/lib/diff";
import { parseNonNegativeInt } from "@/features/calculator/field-validation";
import { fetchResourceSnapshot, saveResourceSnapshot, type ResourceSnapshot } from "./api";

type DraftFields = {
  polychrome: string;
  monochrome: string;
  encryptedMasterTape: string;
  masterTape: string;
  boopon: string;
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

const FIELD_KEYS: (keyof DraftFields)[] = [
  "polychrome",
  "monochrome",
  "encryptedMasterTape",
  "masterTape",
  "boopon",
];

const ZERO_SNAPSHOT: ResourceSnapshot = {
  polychrome: 0,
  monochrome: 0,
  encryptedMasterTape: 0,
  masterTape: 0,
  boopon: 0,
};

function snapshotToDraft(snapshot: ResourceSnapshot): DraftFields {
  return {
    polychrome: String(snapshot.polychrome),
    monochrome: String(snapshot.monochrome),
    encryptedMasterTape: String(snapshot.encryptedMasterTape),
    masterTape: String(snapshot.masterTape),
    boopon: String(snapshot.boopon),
  };
}

function getFieldErrors(draft: DraftFields): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of FIELD_KEYS) {
    const parsed = parseNonNegativeInt(draft[key]);
    if (!parsed.ok) errors[key] = parsed.error;
  }
  return errors;
}

function draftToSnapshot(draft: DraftFields): ResourceSnapshot {
  return {
    polychrome: Number(draft.polychrome),
    monochrome: Number(draft.monochrome),
    encryptedMasterTape: Number(draft.encryptedMasterTape),
    masterTape: Number(draft.masterTape),
    boopon: Number(draft.boopon),
  };
}

export function useResourceForm() {
  const [baseline, setBaseline] = useState<ResourceSnapshot | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [draft, setDraft] = useState<DraftFields>(snapshotToDraft(ZERO_SNAPSHOT));
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<string>("");
  const [previewChanges, setPreviewChanges] = useState<FieldChange<ResourceSnapshot>[]>([]);

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
    fetchResourceSnapshot().then((result) => {
      if (cancelled) return;
      if (result.status === "success") {
        setBaseline(result.data);
        setVersion(result.data.version);
        setDraft(snapshotToDraft(result.data));
        setPhase("editing");
      } else {
        setMessage(result.status === "network_error" ? "Нет соединения." : "message" in result ? result.message : "Не удалось загрузить данные.");
        setPhase("load_error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fieldErrors = getFieldErrors(draft);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const isDirty = baseline !== null && !hasFieldErrors && hasAnyChange(baseline, draftToSnapshot(draft));

  const updateField = (field: keyof DraftFields, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    // Any edit invalidates a stale preview/result — back to plain editing.
    setPhase((prev) =>
      prev === "previewing" || prev === "saved" || prev === "save_error" ? "editing" : prev,
    );
  };

  /** Generates a fresh idempotency key only when the payload actually changed since the last one. */
  function keyForCurrentPayload(payload: ResourceSnapshot): string {
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
    const next = draftToSnapshot(draft);
    const changes = computeFieldDiff(baseline, next);
    keyForCurrentPayload(next);
    setPreviewChanges(changes);
    setPhase("previewing");
  };

  const cancelPreview = () => setPhase("editing");

  const reloadAfterConflict = async () => {
    setPhase("loading");
    const result = await fetchResourceSnapshot();
    if (!isMountedRef.current) return;
    if (result.status === "success") {
      setBaseline(result.data);
      setVersion(result.data.version);
      setDraft(snapshotToDraft(result.data));
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

    const next = draftToSnapshot(draft);
    const key = keyForCurrentPayload(next);
    setPhase("saving");

    const result = await saveResourceSnapshot(next, version, key);
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
    phase,
    message,
    draft,
    previewChanges,
    fieldErrors,
    isDirty,
    updateField,
    openPreview,
    cancelPreview,
    confirmSave,
    reloadAfterConflict,
    canOpenPreview: phase === "editing" && !hasFieldErrors,
  };
}
