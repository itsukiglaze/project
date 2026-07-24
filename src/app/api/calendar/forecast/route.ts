import { NextRequest, NextResponse } from "next/server";
import { parseLocalDate, type LocalDate } from "@/lib/calendar-math";
import { forecastQuerySchema } from "@/lib/validation/calendar-query";
import { apiError } from "@/lib/api/errors";
import { getCurrentUser } from "@/server/services/current-user";
import { getBoundedForecast } from "@/server/services/calendar-forecast-service";
import { getResourceBalanceSnapshot } from "@/server/repositories/resource-balance-repository";

// Read-only and side-effect free — never writes, never materializes.
export const dynamic = "force-dynamic";

/**
 * "Today" in the user's own timezone, via Intl (which correctly handles
 * the UTC-offset conversion) — then parsed with calendar-math's own
 * strict, drift-free parser. This is the one unavoidable place a request
 * needs an actual wall-clock reference; it is not recurrence arithmetic.
 */
function getTodayInTimezone(timezone: string): LocalDate {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return parseLocalDate(formatter.format(new Date()));
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const searchParams = request.nextUrl.searchParams;
  const parsed = forecastQuerySchema.safeParse({ days: searchParams.get("days") });
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте параметры запроса.", parsed.error.flatten().fieldErrors);
  }

  let today: LocalDate;
  try {
    today = getTodayInTimezone(user.timezone);
  } catch {
    today = getTodayInTimezone("UTC");
  }

  const balance = await getResourceBalanceSnapshot(user.id);
  const startingBalance = balance?.polychrome ?? 0;

  const forecast = await getBoundedForecast(user.id, today, parsed.data.days, startingBalance);
  return NextResponse.json(forecast);
}
