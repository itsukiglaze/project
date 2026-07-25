import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/errors";
import { serializeSnapshotComparison } from "@/lib/api/resource-snapshot-dto";
import { getCurrentUser } from "@/server/services/current-user";
import { getLatestResourceSnapshot } from "@/server/services/resource-snapshot-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const latest = await getLatestResourceSnapshot(user.id);
  return NextResponse.json({ snapshot: latest ? serializeSnapshotComparison(latest) : null });
}
