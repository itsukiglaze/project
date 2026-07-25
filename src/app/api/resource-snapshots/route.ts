import { NextRequest, NextResponse } from "next/server";
import { snapshotHistoryQuerySchema } from "@/lib/validation/resource-snapshot";
import { apiError } from "@/lib/api/errors";
import { serializeSnapshotComparison } from "@/lib/api/resource-snapshot-dto";
import { getCurrentUser } from "@/server/services/current-user";
import { listResourceSnapshotHistory } from "@/server/services/resource-snapshot-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "NOT_AUTHENTICATED", "Требуется вход через Telegram.");

  const { searchParams } = new URL(request.url);
  const parsed = snapshotHistoryQuerySchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Проверьте переданные данные.", parsed.error.flatten().fieldErrors);
  }

  const history = await listResourceSnapshotHistory(user.id, parsed.data.from, parsed.data.to);
  return NextResponse.json({ snapshots: history.map(serializeSnapshotComparison) });
}
