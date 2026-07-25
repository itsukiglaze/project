import { NextRequest, NextResponse } from "next/server";
import { parseLocalDate } from "@/lib/calendar-math";
import { upsertExceptionRequestSchema } from "@/lib/validation/calendar-exception";
import { calendarErrorResponse } from "@/lib/api/calendar-errors";
import { apiError } from "@/lib/api/errors";
import { serializeExceptionRecord } from "@/lib/api/calendar-dto";
import { getCurrentUser } from "@/server/services/current-user";
import { upsertOccurrenceException } from "@/server/services/calendar-event-exception-service";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; date: string }> },
) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "Тело запроса слишком велико.");
  }

  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const { id: seriesId, date: rawDate } = await context.params;

  let occurrenceDate;
  try {
    occurrenceDate = parseLocalDate(rawDate);
  } catch {
    return apiError(400, "INVALID_DATE", "Некорректная дата в пути запроса.");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Некорректный JSON в теле запроса.");
  }

  const parsed = upsertExceptionRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.", parsed.error.flatten().fieldErrors);
  }

  const { expectedVersion, idempotencyKey, ...input } = parsed.data;

  try {
    const result = await upsertOccurrenceException(
      user.id,
      seriesId,
      occurrenceDate,
      input,
      expectedVersion,
      idempotencyKey,
    );
    if (!result.ok) {
      if (result.kind === "STALE_STATE") {
        return calendarErrorResponse({ ...result, current: serializeExceptionRecord(result.current) });
      }
      return calendarErrorResponse(result);
    }
    return NextResponse.json({ ...result, record: serializeExceptionRecord(result.record) });
  } catch (err) {
    console.error("PUT /api/calendar/series/[id]/exceptions/[date]: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}
