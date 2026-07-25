"use client";

import Image from "next/image";
import type { CharacterPlacement } from "@/lib/onboarding/steps";

// Bottom placements anchor above the bottom nav (safe-area aware) so the
// character never sits over any bottom-nav spotlight target; left/right
// choice is resolved dynamically by pickCharacterPlacement (see caller).
const PLACEMENT_CLASSES: Record<CharacterPlacement, string> = {
  "right-bottom": "right-2 bottom-[calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom))+88px)]",
  "left-bottom": "left-2 bottom-[calc(var(--tg-safe-area-inset-bottom,env(safe-area-inset-bottom))+88px)]",
  "right-center": "right-2 top-1/2 -translate-y-1/2",
  "left-center": "left-2 top-1/2 -translate-y-1/2",
};

/**
 * Renders the user-provided tutorial guide character exactly as uploaded —
 * no regeneration, no crop, no rounded-corner clip (the asset has no
 * transparency, so any clip would visibly cut off real image content).
 * Decorative: alt is empty because the dialogue card already states
 * everything the character is "saying".
 */
export function OnboardingCharacter({ placement }: { placement: CharacterPlacement }) {
  return (
    <div
      data-onboarding-ui="true"
      aria-hidden="true"
      className={`pointer-events-none fixed z-[61] w-[28vw] min-w-[120px] max-w-[220px] drop-shadow-xl ${PLACEMENT_CLASSES[placement]}`}
    >
      <Image
        src="/onboarding/guide-character.jpg"
        alt=""
        width={1200}
        height={1200}
        priority
        className="h-auto w-full object-contain"
      />
    </div>
  );
}
