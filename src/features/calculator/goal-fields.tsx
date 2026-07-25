"use client";

import { BannerFamily } from "@/config/gacha";
import { MAX_TARGET_COPIES } from "./field-validation";
import { isCharacterBanner, goalChipLabel } from "./types";
import { RadioOption } from "./radio-option";
import { StepSection } from "./step-section";

const CHIP_CLASSNAME =
  "flex min-h-11 min-w-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface text-sm font-semibold text-foreground transition-colors has-[:checked]:border-accent-yellow has-[:checked]:bg-accent-yellow has-[:checked]:font-bold has-[:checked]:text-black has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-yellow";

export function GoalFields({
  family,
  targetCopies,
  onChange,
  error,
}: {
  family: BannerFamily;
  targetCopies: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const groupName = `${family}-target-copies`;
  const errorId = `${groupName}-error`;

  return (
    <StepSection step={4} title="Что вы хотите получить?">
      {family === BannerFamily.STABLE ? (
        <p className="text-xs text-muted">
          Stable Channel не гарантирует конкретного персонажа или W-Engine — здесь можно
          посмотреть только расстояние до ближайшего S-ранга (см. шаг 3 выше), а не
          гарантированное получение выбранной цели.
        </p>
      ) : (
        <div className="space-y-2">
          <div
            role="group"
            aria-label="Желаемый результат"
            aria-describedby={error ? errorId : undefined}
            className="flex flex-wrap gap-2"
          >
            {Array.from({ length: MAX_TARGET_COPIES }, (_, index) => index + 1).map((copies) => (
              <RadioOption
                key={copies}
                name={groupName}
                value={String(copies)}
                checked={targetCopies === String(copies)}
                onChange={onChange}
                className={CHIP_CLASSNAME}
              >
                {goalChipLabel(family, copies)}
              </RadioOption>
            ))}
          </div>
          <p className="text-xs text-muted">
            {isCharacterBanner(family)
              ? "S0 — получить персонажа один раз. S1–S6 — персонаж и дополнительные копии."
              : "Сколько копий вы хотите получить всего, включая первую."}
          </p>
          {error && (
            <p id={errorId} className="text-xs text-accent-red">
              {error}
            </p>
          )}
        </div>
      )}
    </StepSection>
  );
}
