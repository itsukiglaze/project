// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { PityFields } from "./pity-fields";
import { EMPTY_BANNER_STATE_FIELDS } from "./types";

function renderFor(family: BannerFamily) {
  return render(
    <PityFields
      family={family}
      config={getBannerConfig(family)}
      useSaved={false}
      onUseSavedChange={vi.fn()}
      values={EMPTY_BANNER_STATE_FIELDS}
      errors={{}}
      onChange={vi.fn()}
      onToggleGuarantee={vi.fn()}
    />,
  );
}

describe("PityFields", () => {
  it("4. Bangboo does not show an interactive guarantee toggle", () => {
    renderFor(BannerFamily.BANGBOO);
    const checkbox = screen.getByRole("checkbox", { name: /гарантирован/i });
    expect(checkbox).toBeDisabled();
    expect(checkbox).toBeChecked();
  });

  it("Exclusive Agent shows an interactive (enabled) guarantee toggle", () => {
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

  it("Stable shows no guarantee toggle at all, only an explanation", () => {
    renderFor(BannerFamily.STABLE);
    expect(screen.queryByRole("checkbox", { name: /гарантия/i })).not.toBeInTheDocument();
    expect(screen.getByText(/не конкретного персонажа или w-engine/i)).toBeInTheDocument();
  });
});
