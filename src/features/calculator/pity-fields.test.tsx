// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { PityFields } from "./pity-fields";
import { EMPTY_BANNER_STATE_FIELDS } from "./types";
import type { SavedPityState } from "./use-saved-profile-snapshot";

function renderFor(
  family: BannerFamily,
  overrides: { useSaved?: boolean; savedState?: SavedPityState } = {},
) {
  return render(
    <PityFields
      family={family}
      config={getBannerConfig(family)}
      useSaved={overrides.useSaved ?? false}
      onUseSavedChange={vi.fn()}
      values={EMPTY_BANNER_STATE_FIELDS}
      errors={{}}
      onChange={vi.fn()}
      onToggleGuarantee={vi.fn()}
      savedState={overrides.savedState ?? { status: "loading" }}
    />,
  );
}

describe("PityFields", () => {
  it("labels the step as Шаг 3 with the new question-style heading", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT);
    expect(
      screen.getByRole("heading", { name: /шаг 3\..*какое состояние pity использовать/i }),
    ).toBeInTheDocument();
  });

  it("4. Bangboo does not show an interactive guarantee toggle (manual mode)", () => {
    renderFor(BannerFamily.BANGBOO);
    const checkbox = screen.getByRole("checkbox", { name: /гарантирован/i });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toBeChecked();
  });

  it("Exclusive Agent shows an interactive (enabled) guarantee toggle (manual mode)", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT);
    const checkbox = screen.getByRole("checkbox", { name: /гарантия уже активна/i });
    expect(checkbox).toBeEnabled();
  });

  it("5. S-rank pity bound is read from config (Exclusive Agent: 0–89)", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT);
    expect(screen.getByLabelText(/S-rank pity \(0–89\)/)).toBeInTheDocument();
  });

  it("5. S-rank pity bound is read from config (W-Engine: 0–79)", () => {
    renderFor(BannerFamily.W_ENGINE);
    expect(screen.getByLabelText(/S-rank pity \(0–79\)/)).toBeInTheDocument();
  });

  it("Stable shows no guarantee toggle at all, only an explanation (manual mode)", () => {
    renderFor(BannerFamily.STABLE);
    expect(screen.queryByRole("checkbox", { name: /гарантия/i })).not.toBeInTheDocument();
    expect(screen.getByText(/не конкретного персонажа или w-engine/i)).toBeInTheDocument();
  });

  it("saved mode shows a loading message while the snapshot is being fetched", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT, { useSaved: true, savedState: { status: "loading" } });
    expect(screen.getByText(/загружаем сохранённое pity/i)).toBeInTheDocument();
  });

  it("saved mode shows the actual saved pity value", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT, {
      useSaved: true,
      savedState: {
        status: "available",
        snapshot: { sRankPity: 42, aRankPity: 3, guaranteeActive: false, version: 1 },
      },
    });
    expect(screen.getByText("Текущее pity:")).toBeInTheDocument();
    expect(screen.getByText("42 из 90")).toBeInTheDocument();
  });

  it("saved mode shows the guarantee-active state when the saved guarantee is active", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT, {
      useSaved: true,
      savedState: {
        status: "available",
        snapshot: { sRankPity: 42, aRankPity: 3, guaranteeActive: true, version: 1 },
      },
    });
    expect(screen.getByText(/следующий s-ранг гарантированно целевой/i)).toBeInTheDocument();
  });

  it("saved mode shows the 50/50 mechanism when the saved guarantee is not active (Exclusive Agent)", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT, {
      useSaved: true,
      savedState: {
        status: "available",
        snapshot: { sRankPity: 42, aRankPity: 3, guaranteeActive: false, version: 1 },
      },
    });
    expect(screen.getByText(/следующий s-ранг участвует в 50\/50/i)).toBeInTheDocument();
  });

  it("saved mode uses the correct mechanism split for W-Engine (75/25), not a generic 50/50", () => {
    renderFor(BannerFamily.W_ENGINE, {
      useSaved: true,
      savedState: {
        status: "available",
        snapshot: { sRankPity: 10, aRankPity: 1, guaranteeActive: false, version: 1 },
      },
    });
    expect(screen.getByText(/следующий s-ранг участвует в 75\/25/i)).toBeInTheDocument();
  });

  it("saved mode shows the explicit fallback (never a silent zero) when profile pity is unavailable, with a link to Settings", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT, { useSaved: true, savedState: { status: "unavailable" } });
    expect(
      screen.getByText(/сначала сохраните pity в настройках или выберите «ввести вручную»/i),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /настройки/i });
    expect(link).toHaveAttribute("href", "/settings");
  });

  it("saved mode shows the same fallback when the snapshot fetch itself failed", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT, { useSaved: true, savedState: { status: "error" } });
    expect(
      screen.getByText(/сначала сохраните pity в настройках или выберите «ввести вручную»/i),
    ).toBeInTheDocument();
  });
});
