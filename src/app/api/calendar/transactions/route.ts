import { NextRequest, NextResponse } from "next/server";
import { createTransactionRequestSchema } from "@/lib/validation/calendar-transaction";
import { calendarErrorResponse } from "@/lib/api/calendar-errors";
import { apiError } from "@/lib/api/errors";
import { getCurrentUser } from "@/server/services/current-user";
import { createOneTimeCalendarTransaction } from "@/server/services/calendar-transaction-service";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

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

  const parsed = createTransactionRequestSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.", parsed.error.flatten().fieldErrors);
  }

  const { idempotencyKey, ...input } = parsed.data;

  try {
    const result = await createOneTimeCalendarTransaction(user.id, input, idempotencyKey);
    if (!result.ok) return calendarErrorResponse(result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/calendar/transactions: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера.");
  }
}
