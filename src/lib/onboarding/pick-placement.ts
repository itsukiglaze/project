import type { CharacterPlacement } from "./steps";

/** Character asset is a square image; this is the fraction of viewport width it renders at (see character-image.tsx). */
const CHARACTER_SIZE_VW_FRACTION = 0.3;
/** Bottom nav height + safe margin — the character's "bottom" zone always sits above this line, never over the nav bar itself. */
const BOTTOM_CLEARANCE_PX = 88;

const ALL_PLACEMENTS: CharacterPlacement[] = ["right-bottom", "left-bottom", "right-center", "left-center"];

interface SimpleRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function candidateZone(placement: CharacterPlacement, viewportWidth: number, viewportHeight: number): SimpleRect {
  const size = viewportWidth * CHARACTER_SIZE_VW_FRACTION;
  const isRight = placement === "right-bottom" || placement === "right-center";
  const isBottom = placement === "right-bottom" || placement === "left-bottom";

  const left = isRight ? viewportWidth - size : 0;
  const right = isRight ? viewportWidth : size;
  const top = isBottom ? viewportHeight - BOTTOM_CLEARANCE_PX - size : viewportHeight / 2 - size / 2;
  const bottom = isBottom ? viewportHeight - BOTTOM_CLEARANCE_PX : viewportHeight / 2 + size / 2;

  return { left, right, top, bottom };
}

function intersects(a: SimpleRect, b: SimpleRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Picks which corner to render the character in. Starts from the step's
 * preferred placement and falls back through the others, in order, the
 * first time the preferred one would visually overlap the currently
 * spotlighted target — so the character can never cover the real control
 * the user is being asked to interact with.
 */
export function pickCharacterPlacement(
  preferred: CharacterPlacement,
  avoidRect: { left: number; right: number; top: number; bottom: number } | null,
  viewportWidth: number,
  viewportHeight: number,
): CharacterPlacement {
  if (!avoidRect) return preferred;

  const order = [preferred, ...ALL_PLACEMENTS.filter((p) => p !== preferred)];
  for (const candidate of order) {
    const zone = candidateZone(candidate, viewportWidth, viewportHeight);
    if (!intersects(zone, avoidRect)) return candidate;
  }
  return preferred;
}
