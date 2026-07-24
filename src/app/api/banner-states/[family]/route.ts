import { NextRequest, NextResponse } from "next/server";
import { BannerFamily } from "@/config/gacha";
import { saveBannerStateRequestSchema } from "@/lib/validation/banner-state";
import { getCurrentUser } from "@/server/services/current-user";
import { saveBannerState } from "@/server/services/banner-state-service";
import { apiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const VALID_FAMILIES = new Set<string>(Object.values(BannerFamily));

function parseFamily(raw: string): BannerFamily | null {
  return VALID_FAMILIES.has(raw) ? (raw as BannerFamily) : null;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ family: string }> },
) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "Тело запроса слишком велико.");
  }

  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");
  }

  // The route parameter is the ONLY source of truth for which family is
  // being written. The request body schema has no `family` field at all
  // (see saveBannerStateRequestSchema), so there is nothing for it to
  // disagree with.
  const { family: rawFamily } = await context.params;
  const family = parseFamily(rawFamily);
  if (!family) {
    return apiError(404, "UNKNOWN_BANNER_FAMILY", "Неизвестное семейство баннера.");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Некорректный JSON в теле запроса.");
  }

  const parsed = saveBannerStateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Проверьте переданные данные.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const { idempotencyKey, expectedVersion, ...values } = parsed.data;

  try {
    const result = await saveBannerState(user.id, family, values, expectedVersion, idempotencyKey);

    if (!result.ok) {
      if (result.kind === "VALIDATION_ERROR") {
        return apiError(400, "PITY_VALIDATION_ERROR", "Некорректное состояние pity.", {
          input: result.errors,
        });
      }
      if (result.kind === "IDEMPOTENCY_KEY_REUSED") {
        return NextResponse.json(
          {
            error: {
              code: "IDEMPOTENCY_KEY_REUSED",
              message: "Этот idempotency-ключ уже использован для другого запроса.",
            },
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          error: { code: "STALE_STATE", message: "Данные были изменены в другом месте." },
          current: result.current,
          currentVersion: result.currentVersion,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("PUT /api/banner-states/[family]: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}
