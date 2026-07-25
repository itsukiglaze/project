import { describe, expect, it } from "vitest";
import { pickCharacterPlacement } from "./pick-placement";

// Matches character-image.tsx's 28vw render width and the module's own
// BOTTOM_CLEARANCE_PX, so the zone math below reflects reality:
// size ≈ 117px; right-bottom/left-bottom zone y ∈ [639, 756]; *-center
// zone y ∈ [363.5, 480.5].
const VIEWPORT_WIDTH = 390;
const VIEWPORT_HEIGHT = 844;

describe("pickCharacterPlacement", () => {
  it("returns the preferred placement when there is no target to avoid", () => {
    expect(pickCharacterPlacement("right-bottom", null, VIEWPORT_WIDTH, VIEWPORT_HEIGHT)).toBe("right-bottom");
  });

  it("returns the preferred placement when the target does not overlap its zone", () => {
    const avoidRect = { left: 150, right: 240, top: 400, bottom: 440 };
    expect(pickCharacterPlacement("right-bottom", avoidRect, VIEWPORT_WIDTH, VIEWPORT_HEIGHT)).toBe("right-bottom");
  });

  it("keeps the preferred bottom placement when a bottom-nav target sits at the very bottom of the viewport, since the character's bottom zone already clears the nav bar structurally", () => {
    const settingsTabRect = { left: 330, right: 390, top: 788, bottom: 844 };
    expect(pickCharacterPlacement("right-bottom", settingsTabRect, VIEWPORT_WIDTH, VIEWPORT_HEIGHT)).toBe(
      "right-bottom",
    );
  });

  it("falls back to a center placement when the target overlaps both bottom corners", () => {
    // A wide, mid-height target (e.g. a content-area button on a short
    // viewport) can overlap both left-bottom and right-bottom zones at once.
    const wideTarget = { left: 0, right: VIEWPORT_WIDTH, top: 650, bottom: 700 };
    const placement = pickCharacterPlacement("left-bottom", wideTarget, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    expect(placement === "left-center" || placement === "right-center").toBe(true);
  });

  it("falls back through every candidate and still returns the preferred one if all four zones overlap, rather than throwing", () => {
    const everything = { left: 0, right: VIEWPORT_WIDTH, top: 0, bottom: VIEWPORT_HEIGHT };
    expect(() => pickCharacterPlacement("left-center", everything, VIEWPORT_WIDTH, VIEWPORT_HEIGHT)).not.toThrow();
    expect(pickCharacterPlacement("left-center", everything, VIEWPORT_WIDTH, VIEWPORT_HEIGHT)).toBe("left-center");
  });
});
