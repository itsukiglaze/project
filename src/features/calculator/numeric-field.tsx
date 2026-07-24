"use client";

export function NumericField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? "0"}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          const raw = event.target.value;
          // Allow only digits (or empty) as the user types — never
          // silently coerce an in-progress/empty value to "0".
          if (raw === "" || /^\d+$/.test(raw)) {
            onChange(raw);
          }
        }}
        className={`min-h-11 w-full rounded-xl border px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-yellow disabled:opacity-50 ${
          error ? "border-accent-red" : "border-border"
        } bg-surface`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-accent-red">
          {error}
        </p>
      )}
    </div>
  );
}
