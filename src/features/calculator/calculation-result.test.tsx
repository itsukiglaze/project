// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { CalculationResult } from "./calculation-result";
import type { GuaranteedCalculationResult } from "@/lib/gacha-math";

const BASE: GuaranteedCalculationResult = {
  firstTargetCost: 90,
  additionalTargetCost: 180,
  totalRequiredPulls: 90,
  availablePulls: 10,
  missingPulls: 80,
  missingPolychrome: 12800,
  leftoverPolychrome: 50,
  explanation: ["Гарантированный худший сценарий при hard pity 90."],
};

const EXCLUSIVE_CONFIG = getBannerConfig(BannerFamily.EXCLUSIVE_AGENT);
const BANGBOO_CONFIG = getBannerConfig(BannerFamily.BANGBOO);

describe("CalculationResult", () => {
  it("12. clearly labels the result as a guaranteed worst-case maximum, not a probability", () => {
    render(<CalculationResult data={BASE} config={EXCLUSIVE_CONFIG} stale={false} />);
    expect(screen.getByText("Гарантированный максимум")).toBeInTheDocument();
    expect(
      screen.getByText(/это худший сценарий до hard pity, а не прогноз фактического выпадения/i),
    ).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument(); // missingPulls
  });

  it("does not use probabilistic promise language", () => {
    render(<CalculationResult data={BASE} config={EXCLUSIVE_CONFIG} stale={false} />);
    const container = screen.getByText("Гарантированный максимум").closest("section");
    expect(container?.textContent?.toLowerCase()).not.toMatch(/точно выпадет|средняя удача/);
  });

  it("18. hides missingPolychrome when the value itself is null (Bangboo, well-formed response)", () => {
    const bangbooData: GuaranteedCalculationResult = { ...BASE, missingPolychrome: null };
    render(<CalculationResult data={bangbooData} config={BANGBOO_CONFIG} stale={false} />);
    expect(screen.queryByText("Не хватает полихромов")).not.toBeInTheDocument();
  });

  it("5. hides missingPolychrome for Bangboo even if a malformed API response sends a non-null value", () => {
    // Defense-in-depth: the UI must not display this for Bangboo even if
    // the backend contract is violated — Polychrome can never fund a
    // Bangboo pull, so showing this number would actively mislead.
    const malformedBangbooData: GuaranteedCalculationResult = { ...BASE, missingPolychrome: 9999 };
    render(<CalculationResult data={malformedBangbooData} config={BANGBOO_CONFIG} stale={false} />);
    expect(screen.queryByText("Не хватает полихромов")).not.toBeInTheDocument();
    expect(screen.queryByText("9999")).not.toBeInTheDocument();
  });

  it("shows missingPolychrome for non-Bangboo families when present", () => {
    render(<CalculationResult data={BASE} config={EXCLUSIVE_CONFIG} stale={false} />);
    expect(screen.getByText("Не хватает полихромов")).toBeInTheDocument();
  });

  it("shows a staleness banner when stale=true", () => {
    render(<CalculationResult data={BASE} config={EXCLUSIVE_CONFIG} stale />);
    expect(screen.getByText(/параметры изменены/i)).toBeInTheDocument();
  });
});
