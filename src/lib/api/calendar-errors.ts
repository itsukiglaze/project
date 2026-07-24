import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";

export type CalendarServiceErrorResult =
  | { ok: false; kind: "NOT_FOUND" }
  | { ok: false; kind: "STALE_STATE"; current: unknown }
  | { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" }
  | { ok: false; kind: "INVALID_OCCURRENCE"; errors: string[] }
  | { ok: false; kind: "VALIDATION_ERROR"; errors: string[] };

/**
 * Consistent HTTP mapping for every calendar write endpoint's typed
 * service errors:
 *   NOT_FOUND -> 404, STALE_STATE -> 409, IDEMPOTENCY_KEY_REUSED -> 409,
 *   INVALID_OCCURRENCE -> 422, VALIDATION_ERROR -> 400.
 */
export function calendarErrorResponse(result: CalendarServiceErrorResult): NextResponse {
  switch (result.kind) {
    case "NOT_FOUND":
      return apiError(404, "NOT_FOUND", "Ресурс не найден.");
    case "STALE_STATE":
      return NextResponse.json(
        {
          error: { code: "STALE_STATE", message: "Данные были изменены в другом месте." },
          current: result.current,
        },
        { status: 409 },
      );
    case "IDEMPOTENCY_KEY_REUSED":
      return NextResponse.json(
        {
          error: {
            code: "IDEMPOTENCY_KEY_REUSED",
            message: "Этот idempotency-ключ уже использован для другого запроса.",
          },
        },
        { status: 409 },
      );
    case "INVALID_OCCURRENCE":
      return apiError(
        422,
        "INVALID_OCCURRENCE",
        "Указанная дата не является запланированным вхождением серии.",
        { input: result.errors },
      );
    case "VALIDATION_ERROR":
      return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.", {
        input: result.errors,
      });
  }
}
