"use client";

/** Within the 8-16px range the spec allows for the cutout's breathing room around the real element. */
const SPOTLIGHT_PADDING_PX = 12;
const RING_RADIUS_PX = 16;

/**
 * Darkens the whole screen except a rounded rectangle around the real
 * target, using four solid bands around the hole rather than a CSS mask or
 * clip-path. This is deliberate: with four separate elements, the hole has
 * no DOM node covering it at all, so clicks there fall straight through to
 * the real target underneath with zero special-cased click handling —
 * clicks on the bands themselves are simply blocked because nothing
 * handles them.
 */
export function SpotlightMask({ rect, reducedMotion }: { rect: DOMRect; reducedMotion: boolean }) {
  const holeLeft = Math.max(0, rect.left - SPOTLIGHT_PADDING_PX);
  const holeTop = Math.max(0, rect.top - SPOTLIGHT_PADDING_PX);
  const holeRight = rect.right + SPOTLIGHT_PADDING_PX;
  const holeBottom = rect.bottom + SPOTLIGHT_PADDING_PX;

  return (
    <div aria-hidden="true">
      {/* Each band explicitly re-enables pointer-events (see
          onboarding-overlay.tsx's root pointer-events-none) — that's what
          makes them actually block clicks, and is exactly why the hole
          between them has nothing re-enabling it, letting clicks fall
          through to the real target with zero special-cased logic. */}
      {/* top band */}
      <div className="pointer-events-auto fixed inset-x-0 top-0 bg-black/55" style={{ height: holeTop }} />
      {/* bottom band */}
      <div className="pointer-events-auto fixed inset-x-0 bottom-0 bg-black/55" style={{ top: holeBottom }} />
      {/* left band */}
      <div
        className="pointer-events-auto fixed bg-black/55"
        style={{ top: holeTop, bottom: `calc(100vh - ${holeBottom}px)`, left: 0, width: holeLeft }}
      />
      {/* right band */}
      <div
        className="pointer-events-auto fixed bg-black/55"
        style={{ top: holeTop, bottom: `calc(100vh - ${holeBottom}px)`, left: holeRight, right: 0 }}
      />

      {/* Decorative ring around the cutout. The shape of the ring itself
          (not just its yellow color) is what signals "this is selected",
          so it still reads for colorblind users. */}
      <div
        className={`pointer-events-none fixed rounded-2xl border-2 border-accent-yellow ${reducedMotion ? "" : "animate-onboarding-pulse"}`}
        style={{
          left: holeLeft,
          top: holeTop,
          width: holeRight - holeLeft,
          height: holeBottom - holeTop,
          borderRadius: RING_RADIUS_PX,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.6)",
        }}
      />
    </div>
  );
}
