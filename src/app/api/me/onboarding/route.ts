import { NextRequest, NextResponse } from "next/server";
import { updateOnboardingStatusRequestSchema } from "@/lib/validation/onboarding";
import { apiError } from "@/lib/api/errors";
import { getCurrentUser } from "@/server/services/current-user";
import { updateOnboardingStatus } from "@/server/repositories/user-repository";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;

/**
 * Records the outcome of the user's latest onboarding attempt (completed
 * or skipped, at a given tutorial version) — see
 * user-repository.ts#updateOnboardingStatus for why this plain
 * last-write-wins update doesn't need the optimistic-concurrency +
 * idempotency-key ceremony used by every other write endpoint in this
 * codebase. Repeating the same request is already a safe no-op.
 */
export async function POST(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "Тело запроса слишком велико.");
  }

  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Некорректный JSON в теле запроса.");
  }

  const parsed = updateOnboardingStatusRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.", parsed.error.flatten().fieldErrors);
  }

  try {
    const updated = await updateOnboardingStatus(user.id, parsed.data.version, parsed.data.outcome);
    return NextResponse.json({
      onboardingVersion: updated.onboardingVersion,
      onboardingOutcome: updated.onboardingOutcome,
    });
  } catch (err) {
    console.error("POST /api/me/onboarding: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}
