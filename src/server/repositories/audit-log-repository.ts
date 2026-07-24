import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export async function createAuditLog(
  tx: Prisma.TransactionClient,
  userId: string,
  action: string,
  metadata: unknown,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId,
      action,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}
