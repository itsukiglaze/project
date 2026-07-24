import { NextResponse } from "next/server";
import { BannerFamily } from "@/config/gacha";
import { getVersionedBannerState } from "@/server/repositories/banner-state-repository";
import { getCurrentUser } from "@/server/services/current-user";
import { apiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const ALL_FAMILIES = Object.values(BannerFamily);
const DEFAULT_STATE = { sRankPity: 0, aRankPity: 0, guaranteeActive: false, version: 0 };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");
  }

  const states = await Promise.all(
    ALL_FAMILIES.map(async (family) => {
      const state = await getVersionedBannerState(user.id, family);
      return {
        family,
        sRankPity: state?.sRankPity ?? DEFAULT_STATE.sRankPity,
        aRankPity: state?.aRankPity ?? DEFAULT_STATE.aRankPity,
        guaranteeActive: state?.guaranteeActive ?? DEFAULT_STATE.guaranteeActive,
        version: state?.version ?? DEFAULT_STATE.version,
      };
    }),
  );

  return NextResponse.json({ bannerStates: states });
}
