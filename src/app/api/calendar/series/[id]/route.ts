import { NextRequest, NextResponse } from "next/server";
import { deleteSeriesRequestSchema, updateSeriesRequestSchema } from "@/lib/validation/calendar-series";
import { calendarErrorResponse } from "@/lib/api/calendar-errors";
import { apiError } from "@/lib/api/errors";
import { serializeSeriesRecord } from "@/lib/api/calendar-dto";
import { getCurrentUser } from "@/server/services/current-user";
import { deleteEventSeries, updateEventSeries } from "@/server/services/calendar-event-series-service";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

async function readJsonBody(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return { error: apiError(413, "PAYLOAD_TOO_LARGE", "Тело запроса слишком велико.") };
  }
  try {
    return { json: await request.json() };
  } catch {
    return { error: apiError(400, "INVALID_JSON", "Некорректный JSON в теле запроса.") };
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const { id: seriesId } = await context.params;
  const body = await readJsonBody(request);
  if (body.error) return body.error;

  const parsed = updateSeriesRequestSchema.safeParse(body.json);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.", parsed.error.flatten().fieldErrors);
  }

  const { expectedVersion, idempotencyKey, ...input } = parsed.data;

  try {
    const result = await updateEventSeries(user.id, seriesId, input, expectedVersion, idempotencyKey);
    if (!result.ok) {
      if (result.kind === "STALE_STATE") {
        return calendarErrorResponse({ ...result, current: serializeSeriesRecord(result.current) });
      }
      return calendarErrorResponse(result);
    }
    return NextResponse.json({ ...result, record: serializeSeriesRecord(result.record) });
  } catch (err) {
    console.error("PUT /api/calendar/series/[id]: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const { id: seriesId } = await context.params;
  const body = await readJsonBody(request);
  if (body.error) return body.error;

  const parsed = deleteSeriesRequestSchema.safeParse(body.json);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await deleteEventSeries(
      user.id,
      seriesId,
      parsed.data.expectedVersion,
      parsed.data.idempotencyKey,
    );
    if (!result.ok) {
      if (result.kind === "STALE_STATE") {
        return calendarErrorResponse({ ...result, current: serializeSeriesRecord(result.current) });
      }
      return calendarErrorResponse(result);
    }
    return NextResponse.json({ ...result, record: serializeSeriesRecord(result.record) });
  } catch (err) {
    console.error("DELETE /api/calendar/series/[id]: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}
