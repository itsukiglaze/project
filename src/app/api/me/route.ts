import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/services/current-user";
import { apiError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");
  }

  // BigInt does not survive JSON.stringify — send Telegram id as a string.
  return NextResponse.json({
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    timezone: user.timezone,
  });
}
