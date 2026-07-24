import { NextRequest, NextResponse } from "next/server";
import { formatLocalDate } from "@/lib/calendar-math";
import { statisticsOverviewQuerySchema } from "@/lib/validation/statistics-query";
import { apiError } from "@/lib/api/errors";
import { getCurrentUser } from "@/server/services/current-user";
import { getTodayInTimezoneOrUtc } from "@/server/local-date";
import { getStatisticsOverview } from "@/server/services/statistics-service";

// Read-only and side-effect free — never writes, never materializes.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const searchParams = request.nextUrl.searchParams;
  const parsed = statisticsOverviewQuerySchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте параметры запроса.", parsed.error.flatten().fieldErrors);
  }

  const today = getTodayInTimezoneOrUtc(user.timezone);
  const overview = await getStatisticsOverview(user.id, today, parsed.data.from, parsed.data.to);

  // Dates are LocalDate objects ({year,month,day}) internally throughout
  // calendar-math/statistics-math — explicitly formatted to "YYYY-MM-DD"
  // strings here, at the response boundary, matching this DTO's contract.
  return NextResponse.json({
    range: {
      from: formatLocalDate(overview.range.from),
      to: formatLocalDate(overview.range.to),
      today: formatLocalDate(overview.range.today),
      timezone: user.timezone,
    },
    actual: overview.actual,
    scheduled: overview.scheduled,
    expectedRangeTotal: overview.expectedRangeTotal,
    timeline: overview.timeline.map((point) => ({ ...point, date: formatLocalDate(point.date) })),
    breakdowns: overview.breakdowns,
  });
}
