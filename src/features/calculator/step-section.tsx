"use client";

/**
 * Wraps one numbered step of the calculator flow. Plain, undecorated step
 * numbers — a small muted "Шаг N." prefix, not a badge/circle/progress
 * graphic — per the explicit "do not overdecorate" requirement. All steps
 * stay on one scrollable page (this is not a multi-page wizard).
 */
export function StepSection({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  const headingId = `calculator-step-${step}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-3 rounded-2xl border border-border bg-surface p-4"
    >
      <h2 id={headingId} className="text-sm font-bold">
        <span className="text-muted">Шаг {step}.</span> {title}
      </h2>
      {children}
    </section>
  );
}
