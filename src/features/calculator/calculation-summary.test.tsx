// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { CalculationSummary, getSubmitBlockReason } from "./calculation-summary";
import { createDefaultFamilyFormState } from "./types";

describe("CalculationSummary", () => {
  it("shows family, goal, resource source, and pity in one compact line", () => {
    const formState = {
      ...createDefaultFamilyFormState(),
      targetCopies: "3",
      useSavedResources: true,
      useSavedBannerState: true,
    };
    render(
      <CalculationSummary
        family={BannerFamily.EXCLUSIVE_AGENT}
        config={getBannerConfig(BannerFamily.EXCLUSIVE_AGENT)}
        formState={formState}
        pityState={{
          status: "available",
          snapshot: { sRankPity: 42, aRankPity: 3, guaranteeActive: false, version: 1 },
        }}
      />,
    );
    expect(screen.getByText(/эксклюзивный агент · s2 · сохранённые ресурсы · pity 42\/90/i)).toBeInTheDocument();
  });

  it("shows the manually entered pity value when in manual pity mode", () => {
    const formState = {
      ...createDefaultFamilyFormState(),
      targetCopies: "1",
      useSavedResources: false,
      useSavedBannerState: false,
      bannerState: { sRankPity: "10", aRankPity: "1", guaranteeActive: false },
    };
    render(
      <CalculationSummary
        family={BannerFamily.W_ENGINE}
        config={getBannerConfig(BannerFamily.W_ENGINE)}
        formState={formState}
        pityState={{ status: "unavailable" }}
      />,
    );
    expect(screen.getByText(/w-engine · копия 1 · ресурсы вручную · pity 10\/80/i)).toBeInTheDocument();
  });

  it("shows 'ближайший S-ранг' as the goal for Stable, which has no target-copies concept", () => {
    const formState = createDefaultFamilyFormState();
    render(
      <CalculationSummary
        family={BannerFamily.STABLE}
        config={getBannerConfig(BannerFamily.STABLE)}
        formState={formState}
        pityState={{ status: "unavailable" }}
      />,
    );
    expect(screen.getByText(/ближайший s-ранг/i)).toBeInTheDocument();
  });

  it("omits the pity fragment entirely when it isn't known yet, rather than showing a misleading value", () => {
    const formState = { ...createDefaultFamilyFormState(), useSavedBannerState: true };
    render(
      <CalculationSummary
        family={BannerFamily.EXCLUSIVE_AGENT}
        config={getBannerConfig(BannerFamily.EXCLUSIVE_AGENT)}
        formState={formState}
        pityState={{ status: "loading" }}
      />,
    );
    expect(screen.queryByText(/pity/i)).not.toBeInTheDocument();
  });
});

describe("getSubmitBlockReason", () => {
  const available = { status: "available" as const, snapshot: { polychrome: 0, monochrome: 0, encryptedMasterTape: 0, masterTape: 0, boopon: 0, version: 1 } };
  const pityAvailable = { status: "available" as const, snapshot: { sRankPity: 0, aRankPity: 0, guaranteeActive: false, version: 1 } };

  it("returns null (nothing blocking) when everything is ready", () => {
    const reason = getSubmitBlockReason({
      hasFieldErrors: false,
      useSavedResources: true,
      resourcesState: available,
      useSavedBannerState: true,
      pityState: pityAvailable,
    });
    expect(reason).toBeNull();
  });

  it("reports a field-error reason first, even if saved data is also unavailable", () => {
    const reason = getSubmitBlockReason({
      hasFieldErrors: true,
      useSavedResources: true,
      resourcesState: { status: "unavailable" },
      useSavedBannerState: false,
      pityState: pityAvailable,
    });
    expect(reason).toMatch(/проверьте введённые значения/i);
  });

  it("reports the exact reason when saved resources are unavailable", () => {
    const reason = getSubmitBlockReason({
      hasFieldErrors: false,
      useSavedResources: true,
      resourcesState: { status: "unavailable" },
      useSavedBannerState: false,
      pityState: pityAvailable,
    });
    expect(reason).toMatch(/нет сохранённых ресурсов/i);
  });

  it("reports the exact reason when saved resources are still loading", () => {
    const reason = getSubmitBlockReason({
      hasFieldErrors: false,
      useSavedResources: true,
      resourcesState: { status: "loading" },
      useSavedBannerState: false,
      pityState: pityAvailable,
    });
    expect(reason).toMatch(/загружаем сохранённые ресурсы/i);
  });

  it("reports the exact reason when saved pity is unavailable", () => {
    const reason = getSubmitBlockReason({
      hasFieldErrors: false,
      useSavedResources: false,
      resourcesState: available,
      useSavedBannerState: true,
      pityState: { status: "unavailable" },
    });
    expect(reason).toMatch(/нет сохранённого pity/i);
  });

  it("does not block on saved-data availability when manual mode is selected for both", () => {
    const reason = getSubmitBlockReason({
      hasFieldErrors: false,
      useSavedResources: false,
      resourcesState: { status: "unavailable" },
      useSavedBannerState: false,
      pityState: { status: "unavailable" },
    });
    expect(reason).toBeNull();
  });
});
