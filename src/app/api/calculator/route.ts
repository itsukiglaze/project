import { NextRequest, NextResponse } from "next/server";
import { calculatorRequestSchema } from "@/lib/validation/calculator";
import { getCurrentUser } from "@/server/services/current-user";
import { calculateGachaPlan } from "@/server/services/gacha-calculator-service";
import { isUnsupportedTarget } from "@/lib/gacha-math";
import { apiError } from "@/lib/api/errors";

// Read-only per request, but depends on the caller's session + saved
// state, so it must never be statically cached.
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "Тело запроса слишком велико.");
  }

  // Auth strictly from the server-side session — there is no userId field
  // anywhere in the request schema below for a client to supply instead.
  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Некорректный JSON в теле запроса.");
  }

  const parsed = calculatorRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Проверьте переданные данные.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await calculateGachaPlan({
    userId: user.id,
    family: parsed.data.family,
    targetCopies: parsed.data.targetCopies,
    useSavedResources: parsed.data.useSavedResources,
    useSavedBannerState: parsed.data.useSavedBannerState,
    resourceOverrides: parsed.data.resourceOverrides,
    bannerStateOverrides: parsed.data.bannerStateOverrides,
  });

  if (!result.ok) {
    return apiError(400, "CALCULATION_VALIDATION_ERROR", "Данные для расчёта некорректны.", {
      input: result.errors,
    });
  }

  // Stable's "specific target" case is a normal, typed outcome — not an
  // error — so it gets a 200 with a distinguishable `kind` field, never a
  // fabricated number and never an HTTP error status.
  if (isUnsupportedTarget(result.data)) {
    return NextResponse.json({ kind: "UNSUPPORTED_TARGET", reason: result.data.reason });
  }

  return NextResponse.json({ kind: "CALCULATED", ...result.data });
}
