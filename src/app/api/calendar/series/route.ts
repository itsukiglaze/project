import { NextRequest, NextResponse } from "next/server";
import { createSeriesRequestSchema } from "@/lib/validation/calendar-series";
import { calendarErrorResponse } from "@/lib/api/calendar-errors";
import { apiError } from "@/lib/api/errors";
import { getCurrentUser } from "@/server/services/current-user";
import { createEventSeries } from "@/server/services/calendar-event-series-service";
import { listActiveSeriesForUser } from "@/server/repositories/calendar-event-series-repository";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const series = await listActiveSeriesForUser(user.id);
  return NextResponse.json({ series });
}

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

  const parsed = createSeriesRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.", parsed.error.flatten().fieldErrors);
  }

  const { timezone, idempotencyKey, ...input } = parsed.data;

  try {
    const result = await createEventSeries(user.id, input, timezone, idempotencyKey);
    if (!result.ok) return calendarErrorResponse(result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/calendar/series: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}
