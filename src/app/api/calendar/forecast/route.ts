import { NextRequest, NextResponse } from "next/server";
import { forecastQuerySchema } from "@/lib/validation/calendar-query";
import { apiError } from "@/lib/api/errors";
import { serializeForecastResult } from "@/lib/api/calendar-dto";
import { getCurrentUser } from "@/server/services/current-user";
import { getBoundedForecast } from "@/server/services/calendar-forecast-service";
import { getResourceBalanceSnapshot } from "@/server/repositories/resource-balance-repository";
import { getTodayInTimezoneOrUtc } from "@/server/local-date";

// Read-only and side-effect free — never writes, never materializes.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const searchParams = request.nextUrl.searchParams;
  const parsed = forecastQuerySchema.safeParse({ days: searchParams.get("days") });
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте параметры запроса.", parsed.error.flatten().fieldErrors);
  }

  const today = getTodayInTimezoneOrUtc(user.timezone);

  const balance = await getResourceBalanceSnapshot(user.id);
  const startingBalance = balance?.polychrome ?? 0;

  const forecast = await getBoundedForecast(user.id, today, parsed.data.days, startingBalance);
  return NextResponse.json(serializeForecastResult(forecast));
}
