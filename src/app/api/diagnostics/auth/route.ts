import { NextRequest, NextResponse } from "next/server";
import { authDiagnosticEventSchema } from "@/lib/validation/auth";
import { apiError } from "@/lib/api/errors";

// Privacy-safe, structured, unauthenticated (fires before login can
// succeed in the failure cases this exists for) reporting endpoint —
// exists purely so an operator can see WHY an unofficial client's launch
// failed from Vercel logs. The Zod schema is the entire privacy
// guarantee: there is no field for initData/hash/token/user payload/
// cookies, and `.strict()` rejects anything not explicitly listed, so
// nothing else can ever reach this log line, by construction.
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2 * 1024;

export async function POST(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return apiError(413, "PAYLOAD_TOO_LARGE", "Тело запроса слишком велико.");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Некорректный JSON в теле запроса.");
  }

  const parsed = authDiagnosticEventSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.");
  }

  console.info("telegram-launch-diagnostic", JSON.stringify(parsed.data));
  return NextResponse.json({ ok: true });
}
