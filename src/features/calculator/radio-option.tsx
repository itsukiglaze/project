"use client";

/**
 * Native `<input type="radio">` wrapped in a `<label>` styled as a
 * card/pill/chip. Deliberately native radios, not a custom `role="radio"`
 * div-based widget: real radio inputs give correct radio-group semantics,
 * arrow-key navigation, and Enter/Space activation for free, with zero
 * custom ARIA to get wrong. The visually-focused state comes from the
 * input's own `:focus-visible` (kept visible, never suppressed), and the
 * checked/selected state is expressed with `has-[:checked]:` on the label
 * — so selection is never colour-only, since callers pass a visible
 * marker (icon/checkmark/border+weight change) alongside any colour
 * change (see banner-family-selector.tsx / goal-fields.tsx / SourceModeToggle).
 */
export function RadioOption({
  name,
  value,
  checked,
  onChange,
  disabled,
  className,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  disabled?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />
      {children}
    </label>
  );
}
