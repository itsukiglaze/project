import { NextRequest, NextResponse } from "next/server";
import { parseLocalDate } from "@/lib/calendar-math";
import { deleteSnapshotRequestSchema, putSnapshotRequestSchema } from "@/lib/validation/resource-snapshot";
import { calendarErrorResponse } from "@/lib/api/calendar-errors";
import { apiError } from "@/lib/api/errors";
import { serializeSnapshotComparison, serializeSnapshotRecord } from "@/lib/api/resource-snapshot-dto";
import { getCurrentUser } from "@/server/services/current-user";
import { deleteResourceSnapshot, saveResourceSnapshot } from "@/server/services/resource-snapshot-service";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

type RouteContext = { params: Promise<{ date: string }> };

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

function parseDateParam(raw: string) {
  try {
    return { localDate: parseLocalDate(raw) };
  } catch {
    return { error: apiError(400, "INVALID_DATE", "Некорректная дата в пути запроса.") };
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const { date: rawDate } = await context.params;
  const dateResult = parseDateParam(rawDate);
  if (dateResult.error) return dateResult.error;

  const body = await readJsonBody(request);
  if (body.error) return body.error;

  const parsed = putSnapshotRequestSchema.safeParse(body.json);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.", parsed.error.flatten().fieldErrors);
  }

  const { expectedVersion, idempotencyKey, timezone, note, items } = parsed.data;

  try {
    const result = await saveResourceSnapshot(
      user.id,
      { localDate: dateResult.localDate, timezone, note, items },
      expectedVersion,
      idempotencyKey,
    );
    if (!result.ok) {
      if (result.kind === "STALE_STATE") {
        return calendarErrorResponse({
          ...result,
          current: result.current ? serializeSnapshotRecord(result.current) : null,
        });
      }
      return calendarErrorResponse(result);
    }
    return NextResponse.json({ ...result, snapshot: serializeSnapshotComparison(result.snapshot) });
  } catch (err) {
    console.error("PUT /api/resource-snapshots/[date]: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const { date: rawDate } = await context.params;
  const dateResult = parseDateParam(rawDate);
  if (dateResult.error) return dateResult.error;

  const body = await readJsonBody(request);
  if (body.error) return body.error;

  const parsed = deleteSnapshotRequestSchema.safeParse(body.json);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await deleteResourceSnapshot(
      user.id,
      dateResult.localDate,
      parsed.data.expectedVersion,
      parsed.data.idempotencyKey,
    );
    if (!result.ok) {
      if (result.kind === "STALE_STATE") {
        return calendarErrorResponse({ ...result, current: serializeSnapshotRecord(result.current) });
      }
      return calendarErrorResponse(result);
    }
    return NextResponse.json({ ...result, record: serializeSnapshotRecord(result.record) });
  } catch (err) {
    console.error("DELETE /api/resource-snapshots/[date]: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}
