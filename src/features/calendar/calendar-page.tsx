"use client";

import { useMemo, useState } from "react";
import { formatLocalDate, parseLocalDate, type LocalDate } from "@/lib/calendar-math";
import { useAuth } from "@/components/providers/auth-provider";
import { NumericField } from "@/features/calculator/numeric-field";
import { parseNonNegativeInt } from "@/features/calculator/field-validation";
import type { MergedOccurrenceDto, SeriesRecordDto } from "./api";
import { ConfirmDialog } from "./confirm-dialog";
import { DayDetailSheet, type VirtualOccurrenceAction } from "./day-detail-sheet";
import { EditScopeDialog, type EditScope } from "./edit-scope-dialog";
import { useExceptionMutation } from "./use-exception-mutation";
import { useSeriesMutations } from "./use-series-mutations";
import { useOccurrencesQuery, useSeriesListQuery } from "./use-calendar-queries";
import { MonthGridView } from "./month-grid-view";
import { MonthNavigation } from "./month-navigation";
import { SeriesForm, type SeriesFormResult } from "./series-form";
import { SeriesListPanel } from "./series-list-panel";
import { ForecastPanel } from "./forecast-panel";
import { OnboardingEmptyState } from "./onboarding-empty-state";
import { SelectedDatePanel } from "./selected-date-panel";
import { QuickAmountFormDialog } from "./quick-amount-form-dialog";
import { useFocusTrap } from "./use-focus-trap";
import { getTodayLocalDate } from "./local-date-client";
import { onboardingTargetAttr } from "@/components/onboarding/target-attach";
import { summarizeOccurrencesByDay } from "./day-summary";
import {
  addMonthsToYearMonth,
  firstDateOfMonth,
  generateMonthGrid,
  lastDateOfMonth,
  type YearMonth,
} from "./month-grid";
import { useLatestSnapshotQuery } from "@/features/resource-snapshots/use-resource-snapshot-queries";
import { useSnapshotMutations } from "@/features/resource-snapshots/use-snapshot-mutations";
import { SnapshotFormDialog } from "@/features/resource-snapshots/snapshot-form-dialog";
import { SnapshotComparisonResult } from "@/features/resource-snapshots/comparison-result";
import { snapshotMutationErrorMessage } from "@/features/resource-snapshots/mutation-state";
import type { ResourceSnapshotComparisonDto } from "@/features/resource-snapshots/api";

type VirtualOccurrence = Extract<MergedOccurrenceDto, { kind: "virtual" }>;

type Modal =
  | { kind: "none" }
  | { kind: "day-detail"; date: LocalDate }
  | { kind: "create-series" }
  | { kind: "edit-series"; series: SeriesRecordDto }
  | { kind: "delete-series-confirm"; series: SeriesRecordDto }
  | { kind: "edit-scope"; occurrence: VirtualOccurrence }
  | { kind: "override-occurrence"; occurrence: VirtualOccurrence }
  | { kind: "split-series"; occurrence: VirtualOccurrence; series: SeriesRecordDto }
  | { kind: "cancel-occurrence-confirm"; occurrence: VirtualOccurrence }
  | { kind: "quick-amount" }
  | { kind: "update-balance" };

export function CalendarPage() {
  const { user, status: authStatus } = useAuth();
  const today = useMemo(() => getTodayLocalDate(), []);
  const [yearMonth, setYearMonth] = useState<YearMonth>(() => ({ year: today.year, month: today.month }));
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [selectedDate, setSelectedDate] = useState<LocalDate | null>(null);

  // Gated on auth being resolved — the bottom nav (and so a route change to
  // /calendar) is reachable while AuthProvider's own bootstrap is still in
  // flight, so firing these unconditionally on mount can race the session
  // cookie being set and come back 401, which would otherwise look
  // identical to a genuine load failure and never retry on its own.
  const queriesEnabled = authStatus === "authenticated";
  const rangeStart = firstDateOfMonth(yearMonth);
  const rangeEnd = lastDateOfMonth(yearMonth);
  const occurrencesQuery = useOccurrencesQuery(rangeStart, rangeEnd, queriesEnabled);
  // Single source of truth for the loaded series list — passed to
  // SeriesListPanel and also used directly to resolve a series by id for
  // the edit-scope flow, so we never issue an extra fetch just to look one up.
  const seriesQuery = useSeriesListQuery(queriesEnabled);
  const seriesMutations = useSeriesMutations();
  const exceptionMutation = useExceptionMutation();
  const latestSnapshotQuery = useLatestSnapshotQuery(queriesEnabled);
  const snapshotMutations = useSnapshotMutations();
  const [balanceJustSaved, setBalanceJustSaved] = useState<ResourceSnapshotComparisonDto | null>(null);

  const weeks = useMemo(() => generateMonthGrid(yearMonth.year, yearMonth.month), [yearMonth]);
  const summaries = useMemo(
    () =>
      occurrencesQuery.status === "success"
        ? summarizeOccurrencesByDay(occurrencesQuery.data.occurrences)
        : new Map(),
    [occurrencesQuery],
  );

  const timezone = user?.timezone ?? "UTC";
  const seriesList = seriesQuery.status === "success" ? seriesQuery.data.series : [];

  function occurrencesForDay(date: LocalDate): MergedOccurrenceDto[] {
    if (occurrencesQuery.status !== "success") return [];
    const key = formatLocalDate(date);
    return occurrencesQuery.data.occurrences.filter(
      (o) => (o.kind === "actual" ? o.localDate : o.occurrenceDate) === key,
    );
  }

  function findLoadedSeries(seriesId: string): SeriesRecordDto | null {
    return seriesList.find((s) => s.id === seriesId) ?? null;
  }

  function handleEditSeriesOccurrence(occurrence: VirtualOccurrence, action: VirtualOccurrenceAction) {
    if (action === "cancel") {
      setModal({ kind: "cancel-occurrence-confirm", occurrence });
    } else {
      setModal({ kind: "edit-scope", occurrence });
    }
  }

  function openDayDetail(date: LocalDate) {
    setSelectedDate(date);
    setModal({ kind: "day-detail", date });
  }

  const hasAnySource = seriesQuery.status === "success" && seriesList.length > 0;
  // "No recurring series and no calendar transactions" — series existence is
  // known globally (seriesQuery), but a one-time transaction can only be
  // checked against the currently-loaded month's occurrences without adding
  // a new API call, which is out of scope here. This correctly triggers for
  // a genuine first-time user landing on the default (current) month.
  const currentMonthHasActualTransaction =
    occurrencesQuery.status === "success" && occurrencesQuery.data.occurrences.some((o) => o.kind === "actual");
  const showOnboarding =
    seriesQuery.status === "success" && !hasAnySource && occurrencesQuery.status === "success" && !currentMonthHasActualTransaction;

  const selectedDateOccurrences = selectedDate ? occurrencesForDay(selectedDate) : [];

  return (
    <div className="space-y-4 p-4 pt-6">
      <header>
        <h1 className="text-xl font-bold">Календарь доходов</h1>
        <p className="text-xs text-muted">
          Добавьте регулярные и разовые поступления — календарь покажет, когда они ожидаются и каким
          станет баланс.
        </p>
      </header>

      {showOnboarding && (
        <OnboardingEmptyState
          onAddSource={() => setModal({ kind: "create-series" })}
          onAddOneTime={() => openDayDetail(today)}
        />
      )}

      {!showOnboarding && (
        <section
          className="space-y-2 rounded-2xl border border-border bg-surface p-4"
          {...onboardingTargetAttr("calendar-actions")}
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModal({ kind: "create-series" })}
              className="min-h-11 flex-1 rounded-xl border border-border text-xs font-semibold"
            >
              + Добавить источник
            </button>
            <button
              type="button"
              onClick={() => setModal({ kind: "quick-amount" })}
              className="min-h-11 flex-1 rounded-xl border border-border text-xs font-semibold"
            >
              + Добавить сумму
            </button>
            <button
              type="button"
              onClick={() => setModal({ kind: "update-balance" })}
              className="min-h-11 flex-1 rounded-xl bg-accent-yellow text-xs font-bold text-black"
            >
              Обновить баланс
            </button>
          </div>
          <p className="text-xs text-muted">
            Источники и суммы планируют поступления. Баланс фиксирует, сколько ресурсов у вас
            фактически сейчас.
          </p>
        </section>
      )}

      {balanceJustSaved && modal.kind === "none" && (
        <SnapshotComparisonResult snapshot={balanceJustSaved} />
      )}

      <ForecastPanel enabled={queriesEnabled} />

      <SeriesListPanel
        query={seriesQuery}
        onCreate={() => setModal({ kind: "create-series" })}
        onEdit={(series) => setModal({ kind: "edit-series", series })}
        onDelete={(series) => setModal({ kind: "delete-series-confirm", series })}
      />

      <div className="space-y-2">
        <MonthNavigation
          yearMonth={yearMonth}
          onPrev={() => setYearMonth((prev) => addMonthsToYearMonth(prev, -1))}
          onNext={() => setYearMonth((prev) => addMonthsToYearMonth(prev, 1))}
          onToday={() => setYearMonth({ year: today.year, month: today.month })}
        />
        <p className="text-xs text-muted">Нажмите на дату, чтобы увидеть поступления.</p>

        {occurrencesQuery.status === "loading" && (
          <div className="animate-pulse rounded-2xl bg-border" style={{ height: 280 }} />
        )}

        {occurrencesQuery.status === "error" && (
          <section
            role="alert"
            className="space-y-2 rounded-2xl border border-accent-red/40 bg-accent-red/5 p-4 text-sm"
          >
            <p>Не удалось загрузить календарь.</p>
            <button
              type="button"
              onClick={occurrencesQuery.refetch}
              className="min-h-11 w-full rounded-xl bg-surface-contrast text-sm font-semibold text-background"
            >
              Повторить загрузку календаря
            </button>
          </section>
        )}

        {occurrencesQuery.status === "success" && (
          <MonthGridView
            weeks={weeks}
            today={today}
            selectedDate={selectedDate}
            summaries={summaries}
            onSelectDay={openDayDetail}
          />
        )}

        {!hasAnySource && !showOnboarding && occurrencesQuery.status === "success" && (
          <p className="text-xs text-muted">
            Добавьте источник, чтобы увидеть будущие поступления на календаре.
          </p>
        )}
      </div>

      <SelectedDatePanel
        date={selectedDate}
        hasAnySource={hasAnySource}
        occurrences={selectedDateOccurrences}
        onOpenDetails={() => selectedDate && openDayDetail(selectedDate)}
      />

      {modal.kind === "day-detail" && (
        <DayDetailSheet
          date={modal.date}
          timezone={timezone}
          occurrences={occurrencesForDay(modal.date)}
          onClose={() => setModal({ kind: "none" })}
          onEditSeriesOccurrence={handleEditSeriesOccurrence}
        />
      )}

      {modal.kind === "quick-amount" && (
        <QuickAmountFormDialog date={today} timezone={timezone} onClose={() => setModal({ kind: "none" })} />
      )}

      {modal.kind === "update-balance" && (
        <SnapshotFormDialog
          today={today}
          prefillItems={
            latestSnapshotQuery.status === "success" && latestSnapshotQuery.data.snapshot
              ? latestSnapshotQuery.data.snapshot.record.items
              : []
          }
          submitting={snapshotMutations.state.status === "loading"}
          errorMessage={snapshotMutationErrorMessage(snapshotMutations.state)}
          onCancel={() => setModal({ kind: "none" })}
          onSubmit={async (result) => {
            const latest = latestSnapshotQuery.status === "success" ? latestSnapshotQuery.data.snapshot : null;
            const isSameDate = latest !== null && latest.record.localDate === formatLocalDate(result.localDate);
            const expectedVersion = isSameDate ? latest!.record.version : 0;
            const saved = await snapshotMutations.save(
              result.localDate,
              { timezone, note: result.note, items: result.items },
              expectedVersion,
            );
            if (saved) {
              setModal({ kind: "none" });
              setBalanceJustSaved(saved.snapshot);
              snapshotMutations.resetState();
            }
          }}
        />
      )}

      {(modal.kind === "create-series" || modal.kind === "edit-series") && (
        <SeriesFormDialog
          mode={modal.kind === "create-series" ? "create" : "edit"}
          existing={modal.kind === "edit-series" ? modal.series : undefined}
          submitting={seriesMutations.state.status === "loading"}
          onCancel={() => setModal({ kind: "none" })}
          onSubmit={async (result: SeriesFormResult) => {
            if (modal.kind === "create-series") {
              const created = await seriesMutations.create(result.template, result.rule, timezone);
              if (created) setModal({ kind: "none" });
            } else {
              const updated = await seriesMutations.update(
                modal.series.id,
                result.template,
                result.rule,
                modal.series.version,
              );
              if (updated) setModal({ kind: "none" });
            }
          }}
        />
      )}

      {modal.kind === "delete-series-confirm" && (
        <ConfirmDialog
          title="Удалить серию?"
          message="Прошлые записи сохранятся, но новые вхождения перестанут создаваться."
          confirmLabel="Удалить"
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={async () => {
            const result = await seriesMutations.remove(modal.series.id, modal.series.version);
            if (result) setModal({ kind: "none" });
          }}
        />
      )}

      {modal.kind === "cancel-occurrence-confirm" && (
        <ConfirmDialog
          title="Отменить это вхождение?"
          message="Только этот день серии будет отменён — остальные вхождения не изменятся."
          confirmLabel="Отменить вхождение"
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={async () => {
            const occ = modal.occurrence;
            const result = await exceptionMutation.upsert(
              occ.seriesId,
              parseLocalDate(occ.occurrenceDate),
              {
                isCancelled: true,
                amountOverride: null,
                currencyTypeOverride: null,
                sourceOverride: null,
                bannerFamilyOverride: null,
                noteOverride: null,
              },
              0,
            );
            if (result) setModal({ kind: "none" });
          }}
        />
      )}

      {modal.kind === "edit-scope" && (
        <EditScopeDialog
          onCancel={() => setModal({ kind: "none" })}
          onSelect={(scope: EditScope) => {
            const occ = modal.occurrence;
            const loadedSeries = findLoadedSeries(occ.seriesId);
            if (scope === "THIS") {
              setModal({ kind: "override-occurrence", occurrence: occ });
            } else if (scope === "THIS_AND_FUTURE") {
              if (!loadedSeries) return;
              setModal({ kind: "split-series", occurrence: occ, series: loadedSeries });
            } else {
              if (!loadedSeries) return;
              setModal({ kind: "edit-series", series: loadedSeries });
            }
          }}
        />
      )}

      {modal.kind === "override-occurrence" && (
        <OccurrenceOverrideModal
          occurrence={modal.occurrence}
          submitting={exceptionMutation.state.status === "loading"}
          onCancel={() => setModal({ kind: "none" })}
          onSubmit={async (amount) => {
            const occ = modal.occurrence;
            const result = await exceptionMutation.upsert(
              occ.seriesId,
              parseLocalDate(occ.occurrenceDate),
              {
                isCancelled: false,
                amountOverride: amount,
                currencyTypeOverride: null,
                sourceOverride: null,
                bannerFamilyOverride: null,
                noteOverride: null,
              },
              0,
            );
            if (result) setModal({ kind: "none" });
          }}
        />
      )}

      {modal.kind === "split-series" && (
        <SeriesFormDialog
          mode="split"
          existing={modal.series}
          splitDate={parseLocalDate(modal.occurrence.occurrenceDate)}
          submitting={seriesMutations.state.status === "loading"}
          onCancel={() => setModal({ kind: "none" })}
          onSubmit={async (result: SeriesFormResult) => {
            const split = await seriesMutations.split(
              modal.series.id,
              result.template,
              result.rule,
              parseLocalDate(modal.occurrence.occurrenceDate),
              modal.series.version,
            );
            if (split) setModal({ kind: "none" });
          }}
        />
      )}
    </div>
  );
}

function SeriesFormDialog({
  mode,
  existing,
  splitDate,
  submitting,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit" | "split";
  existing?: SeriesRecordDto;
  splitDate?: LocalDate;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (result: SeriesFormResult) => void;
}) {
  const containerRef = useFocusTrap<HTMLDivElement>(onCancel);
  const label = mode === "split" ? "Разделить серию" : "Серия";

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-4">
        <SeriesForm
          mode={mode}
          existing={existing}
          splitDate={splitDate}
          submitting={submitting}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

function OccurrenceOverrideModal({
  occurrence,
  submitting,
  onCancel,
  onSubmit,
}: {
  occurrence: VirtualOccurrence;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(String(occurrence.amount));
  const result = parseNonNegativeInt(amount);
  const containerRef = useFocusTrap<HTMLDivElement>(onCancel);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Изменить это вхождение"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm space-y-3 rounded-2xl bg-surface p-4">
        <h2 className="text-sm font-bold">Изменить сумму этого вхождения</h2>
        <NumericField
          id="occurrence-amount"
          label="Новая сумма"
          value={amount}
          onChange={setAmount}
          error={!result.ok ? result.error : undefined}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-xl border border-border text-sm font-semibold"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={submitting || !result.ok}
            onClick={() => result.ok && onSubmit(result.value)}
            className="min-h-11 flex-1 rounded-xl bg-accent-yellow text-sm font-bold text-black disabled:opacity-40"
          >
            {submitting ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
