import { NextRequest, NextResponse } from "next/server";
import { splitSeriesRequestSchema } from "@/lib/validation/calendar-series";
import { calendarErrorResponse } from "@/lib/api/calendar-errors";
import { apiError } from "@/lib/api/errors";
import { getCurrentUser } from "@/server/services/current-user";
import { splitEventSeries } from "@/server/services/calendar-event-series-service";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "Тело запроса слишком велико.");
  }

  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const { id: seriesId } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Некорректный JSON в теле запроса.");
  }

  const parsed = splitSeriesRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.", parsed.error.flatten().fieldErrors);
  }

  const { splitDate, expectedVersion, idempotencyKey, ...newInput } = parsed.data;

  try {
    const result = await splitEventSeries(user.id, seriesId, splitDate, newInput, expectedVersion, idempotencyKey);
    if (!result.ok) return calendarErrorResponse(result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/calendar/series/[id]/split: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}
