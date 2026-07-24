"use client";

export function SourceModeToggle({
  useSaved,
  onChange,
  savedLabel = "Из профиля",
  temporaryLabel = "Временные значения",
}: {
  useSaved: boolean;
  onChange: (useSaved: boolean) => void;
  savedLabel?: string;
  temporaryLabel?: string;
}) {
  return (
    <div className="flex rounded-xl border border-border bg-surface p-1" role="group">
      <button
        type="button"
        aria-pressed={useSaved}
        onClick={() => onChange(true)}
        className={`min-h-11 flex-1 rounded-lg text-xs font-semibold transition-colors ${
          useSaved ? "bg-accent-yellow text-black" : "text-muted"
        }`}
      >
        {savedLabel}
      </button>
      <button
        type="button"
        aria-pressed={!useSaved}
        onClick={() => onChange(false)}
        className={`min-h-11 flex-1 rounded-lg text-xs font-semibold transition-colors ${
          !useSaved ? "bg-accent-yellow text-black" : "text-muted"
        }`}
      >
        {temporaryLabel}
      </button>
    </div>
  );
}
