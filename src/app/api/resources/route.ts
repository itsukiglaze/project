import { NextRequest, NextResponse } from "next/server";
import { saveResourcesRequestSchema } from "@/lib/validation/resources";
import { getCurrentUser } from "@/server/services/current-user";
import { getVersionedResourceBalance } from "@/server/repositories/resource-balance-repository";
import { saveResources } from "@/server/services/resource-service";
import { apiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const EMPTY_VERSIONED_SNAPSHOT = {
  polychrome: 0,
  monochrome: 0,
  encryptedMasterTape: 0,
  masterTape: 0,
  boopon: 0,
  version: 0,
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");
  }

  const snapshot = (await getVersionedResourceBalance(user.id)) ?? EMPTY_VERSIONED_SNAPSHOT;
  return NextResponse.json(snapshot);
}

export async function PUT(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "Тело запроса слишком велико.");
  }

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

  const parsed = saveResourcesRequestSchema.safeParse(json);
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
    const result = await saveResources(user.id, values, expectedVersion, idempotencyKey);

    if (!result.ok) {
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
      // Typed conflict, not a generic error — the client is expected to
      // reload current state and re-diff, not treat this as a failure to
      // retry blindly.
      return NextResponse.json(
        { error: { code: "STALE_STATE", message: "Данные были изменены в другом месте." }, current: result.current, currentVersion: result.currentVersion },
        { status: 409 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("PUT /api/resources: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}
