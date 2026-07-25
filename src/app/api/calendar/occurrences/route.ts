import { NextRequest, NextResponse } from "next/server";
import { occurrencesQuerySchema } from "@/lib/validation/calendar-query";
import { apiError } from "@/lib/api/errors";
import { serializeMergedOccurrence } from "@/lib/api/calendar-dto";
import { getCurrentUser } from "@/server/services/current-user";
import { getMergedOccurrences } from "@/server/services/calendar-occurrence-service";

// Read-only and side-effect free — never materializes anything, never
// writes. Must never be cached across users, so still force-dynamic.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const searchParams = request.nextUrl.searchParams;
  const parsed = occurrencesQuerySchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте параметры запроса.", parsed.error.flatten().fieldErrors);
  }

  const occurrences = await getMergedOccurrences(user.id, parsed.data.from, parsed.data.to);
  return NextResponse.json({ occurrences: occurrences.map(serializeMergedOccurrence) });
}
