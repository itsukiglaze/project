"use client";

import { RadioOption } from "./radio-option";

const OPTION_CLASSNAME =
  "min-h-11 flex-1 cursor-pointer rounded-lg border border-transparent text-center text-xs font-semibold leading-[2.75rem] text-muted transition-colors has-[:checked]:border-black/20 has-[:checked]:bg-accent-yellow has-[:checked]:font-bold has-[:checked]:text-black has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-yellow";

export function SourceModeToggle({
  useSaved,
  onChange,
  savedLabel = "Из профиля",
  temporaryLabel = "Временные значения",
  groupName,
}: {
  useSaved: boolean;
  onChange: (useSaved: boolean) => void;
  savedLabel?: string;
  temporaryLabel?: string;
  /** Unique per instance — the page renders more than one of these (resources, pity), and a shared name would merge them into one native radio group. */
  groupName: string;
}) {
  return (
    <div className="flex rounded-xl border border-border bg-surface p-1">
      <RadioOption
        name={groupName}
        value="saved"
        checked={useSaved}
        onChange={() => onChange(true)}
        className={OPTION_CLASSNAME}
      >
        {savedLabel}
      </RadioOption>
      <RadioOption
        name={groupName}
        value="manual"
        checked={!useSaved}
        onChange={() => onChange(false)}
        className={OPTION_CLASSNAME}
      >
        {temporaryLabel}
      </RadioOption>
    </div>
  );
}
