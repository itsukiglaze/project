"use client";

import { useState } from "react";
import { formatLocalDate } from "@/lib/calendar-math";
import { useAuth } from "@/components/providers/auth-provider";
import { getTodayLocalDate } from "@/features/calendar/local-date-client";
import { useLatestSnapshotQuery } from "./use-resource-snapshot-queries";
import { useSnapshotMutations } from "./use-snapshot-mutations";
import { snapshotMutationErrorMessage } from "./mutation-state";
import { SnapshotFormDialog } from "./snapshot-form-dialog";
import { SnapshotComparisonResult } from "./comparison-result";
import { CURRENCY_TYPE_LABELS } from "./labels";
import type { SnapshotFormResult } from "./snapshot-form";
import type { ResourceSnapshotComparisonDto } from "./api";
import { HistoryDialog } from "./history-dialog";

function formatUpdatedAt(capturedAt: string): string {
  return new Date(capturedAt).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BalanceCard() {
  const { status: authStatus, user } = useAuth();
  const query = useLatestSnapshotQuery(authStatus === "authenticated");
  const mutations = useSnapshotMutations();
  const [formOpen, setFormOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [justSaved, setJustSaved] = useState<ResourceSnapshotComparisonDto | null>(null);

  const timezone = user?.timezone ?? "UTC";

  async function handleSubmit(result: SnapshotFormResult) {
    const latest = query.status === "success" ? query.data.snapshot : null;
    const isSameDate = latest !== null && latest.record.localDate === formatLocalDate(result.localDate);
    const expectedVersion = isSameDate ? latest!.record.version : 0;

    const saved = await mutations.save(
      result.localDate,
      { timezone, note: result.note, items: result.items },
      expectedVersion,
    );
    if (saved) {
      setFormOpen(false);
      setJustSaved(saved.snapshot);
      mutations.resetState();
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Баланс ресурсов сегодня</h2>
        <button type="button" onClick={() => setHistoryOpen(true)} className="text-xs font-semibold text-muted underline">
          История баланса
        </button>
      </div>

      {query.status === "loading" && (
        <div className="animate-pulse rounded-xl bg-border" style={{ height: 60 }} />
      )}

      {query.status === "error" && (
        <div role="alert" className="space-y-2">
          <p className="text-xs text-accent-red">Не удалось загрузить баланс ресурсов.</p>
          <button
            type="button"
            onClick={query.refetch}
            className="min-h-11 w-full rounded-xl bg-surface-contrast text-xs font-semibold text-background"
          >
            Повторить загрузку баланса
          </button>
        </div>
      )}

      {query.status === "success" && !query.data.snapshot && (
        <p className="text-xs text-muted">
          Сохраните текущие ресурсы, чтобы отслеживать изменения между днями.
        </p>
      )}

      {query.status === "success" && query.data.snapshot && (
        <div className="space-y-1">
          {query.data.snapshot.record.items.map((item) => (
            <div key={item.currencyType} className="flex items-center justify-between text-sm">
              <span className="text-muted">{CURRENCY_TYPE_LABELS[item.currencyType]}</span>
              <span className="font-semibold">{item.amount.toLocaleString("ru-RU")}</span>
            </div>
          ))}
          <p className="text-xs text-muted">
            Обновлено {formatUpdatedAt(query.data.snapshot.record.capturedAt)}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="min-h-11 w-full rounded-xl bg-accent-yellow text-sm font-bold text-black"
      >
        Обновить баланс
      </button>

      {justSaved && !formOpen && <SnapshotComparisonResult snapshot={justSaved} />}

      {formOpen && (
        <SnapshotFormDialog
          today={getTodayLocalDate()}
          prefillItems={query.status === "success" && query.data.snapshot ? query.data.snapshot.record.items : []}
          submitting={mutations.state.status === "loading"}
          errorMessage={snapshotMutationErrorMessage(mutations.state)}
          onCancel={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {historyOpen && <HistoryDialog onClose={() => setHistoryOpen(false)} />}
    </section>
  );
}
