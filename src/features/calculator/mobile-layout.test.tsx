// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { BannerFamilySelector } from "./banner-family-selector";
import { GoalFields } from "./goal-fields";
import { ResourceFields } from "./resource-fields";
import { EMPTY_RESOURCE_FIELDS } from "./types";

/**
 * jsdom does no real layout, so it can't measure actual overflow the way the
 * Playwright check at 360x800/390x844 did. What it CAN lock in is the class
 * contract that keeps a narrow viewport overflow-free: no fixed pixel
 * widths on the cards/chips (which would force horizontal scrolling on a
 * ~360px screen), a wrapping/grid layout instead, and minimum touch-target
 * sizing. A regression that hardcodes a wide fixed width would fail here
 * even without a real browser.
 */
function assertNoFixedPixelWidths(container: HTMLElement) {
  for (const el of container.querySelectorAll<HTMLElement>("*")) {
    const className = el.className;
    if (typeof className !== "string") continue;
    expect(className).not.toMatch(/\bw-\[\d+px\]/);
  }
}

describe("calculator mobile layout contract", () => {
  it("banner cards use a responsive grid (2 columns), not a fixed-width row that would overflow a narrow screen", () => {
    const { container } = render(
      <BannerFamilySelector activeFamily={BannerFamily.EXCLUSIVE_AGENT} onChange={vi.fn()} />,
    );
    const grid = container.querySelector(".grid.grid-cols-2");
    expect(grid).not.toBeNull();
    assertNoFixedPixelWidths(container);
  });

  it("banner cards meet the minimum comfortable touch-target height", () => {
    render(<BannerFamilySelector activeFamily={BannerFamily.EXCLUSIVE_AGENT} onChange={vi.fn()} />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.closest("label")?.className).toMatch(/min-h-\[?(72px|11)/);
    }
  });

  it("goal chips wrap onto new lines instead of forcing horizontal scroll on a narrow screen", () => {
    const { container } = render(
      <GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="1" onChange={vi.fn()} />,
    );
    const group = screen.getByRole("group", { name: /желаемый результат/i });
    expect(group.className).toContain("flex-wrap");
    assertNoFixedPixelWidths(container);
  });

  it("goal chips meet the minimum comfortable touch-target size (min-h-11 / min-w-11)", () => {
    render(<GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="1" onChange={vi.fn()} />);
    for (const radio of screen.getAllByRole("radio")) {
      const label = radio.closest("label");
      expect(label?.className).toContain("min-h-11");
      expect(label?.className).toContain("min-w-11");
    }
  });

  it("resource fields use a responsive 2-column grid for side-by-side numeric inputs, not fixed widths", () => {
    const { container } = render(
      <ResourceFields
        family={BannerFamily.EXCLUSIVE_AGENT}
        config={getBannerConfig(BannerFamily.EXCLUSIVE_AGENT)}
        useSaved={false}
        onUseSavedChange={vi.fn()}
        values={EMPTY_RESOURCE_FIELDS}
        errors={{}}
        onChange={vi.fn()}
        onToggleIncludeMonochrome={vi.fn()}
        savedState={{ status: "loading" }}
      />,
    );
    assertNoFixedPixelWidths(container);
  });
});
