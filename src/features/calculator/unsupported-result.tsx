"use client";

export function UnsupportedResult({ reason, stale }: { reason: string; stale: boolean }) {
  return (
    <section
      role="status"
      className="space-y-2 rounded-2xl border border-border bg-surface p-4"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-yellow text-xs font-bold text-black">
          i
        </span>
        <h2 className="text-sm font-bold">Гарантия недоступна для этой цели</h2>
      </div>
      <p className="text-xs text-muted">{reason}</p>

      {stale && (
        <p className="rounded-lg border border-accent-orange/40 bg-accent-orange/10 px-3 py-2 text-xs font-medium text-accent-orange">
          Параметры изменены — выполните расчёт повторно.
        </p>
      )}
    </section>
  );
}
