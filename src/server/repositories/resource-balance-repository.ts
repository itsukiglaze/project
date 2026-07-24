import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ResourceInput } from "@/lib/gacha-math/types";

export async function getResourceBalance(
  userId: string,
  includeMonochrome: boolean,
): Promise<ResourceInput | null> {
  const row = await prisma.resourceBalance.findUnique({ where: { userId } });
  if (!row) return null;

  return {
    polychrome: row.polychrome,
    monochrome: row.monochrome,
    encryptedMasterTape: row.encryptedMasterTape,
    masterTape: row.masterTape,
    boopon: row.boopon,
    includeMonochrome,
  };
}

export type ResourceBalanceSnapshot = {
  polychrome: number;
  monochrome: number;
  encryptedMasterTape: number;
  masterTape: number;
  boopon: number;
};

export type VersionedResourceBalance = ResourceBalanceSnapshot & { version: number };

/** Raw balance row without the client-only `includeMonochrome` preference. */
export async function getResourceBalanceSnapshot(
  userId: string,
): Promise<ResourceBalanceSnapshot | null> {
  const row = await prisma.resourceBalance.findUnique({ where: { userId } });
  if (!row) return null;
  return toSnapshot(row);
}

/** Same as getResourceBalanceSnapshot, but also exposes the optimistic-concurrency version. */
export async function getVersionedResourceBalance(
  userId: string,
): Promise<VersionedResourceBalance | null> {
  const row = await prisma.resourceBalance.findUnique({ where: { userId } });
  if (!row) return null;
  return { ...toSnapshot(row), version: row.version };
}

function toSnapshot(row: {
  polychrome: number;
  monochrome: number;
  encryptedMasterTape: number;
  masterTape: number;
  boopon: number;
}): ResourceBalanceSnapshot {
  return {
    polychrome: row.polychrome,
    monochrome: row.monochrome,
    encryptedMasterTape: row.encryptedMasterTape,
    masterTape: row.masterTape,
    boopon: row.boopon,
  };
}

/**
 * Upserts a user's resource balance to an absolute new snapshot, INSIDE
 * the given transaction client — see resource-service.ts.
 *
 * Retained for callers that don't need optimistic-concurrency checking.
 * Prefer upsertResourceBalanceWithVersion for anything reachable from a
 * user-facing save flow.
 */
export async function upsertResourceBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  values: ResourceBalanceSnapshot,
): Promise<ResourceBalanceSnapshot> {
  const row = await tx.resourceBalance.upsert({
    where: { userId },
    create: { userId, ...values },
    update: values,
  });
  return toSnapshot(row);
}

export type UpsertResourceResult =
  | { kind: "OK"; snapshot: ResourceBalanceSnapshot; version: number }
  | { kind: "VERSION_CONFLICT"; current: ResourceBalanceSnapshot; version: number };

/**
 * Optimistic-concurrency-aware upsert.
 *
 * `expectedVersion` must be the version the caller last read (0 as a
 * sentinel meaning "I believe no row exists yet"). The actual conflict
 * check is the `WHERE version = expectedVersion` inside a single atomic
 * `updateMany` — this is safe even under concurrent transactions because
 * the WHERE clause is evaluated against the row's true committed state at
 * write time, not against a value read earlier in this transaction.
 */
export async function upsertResourceBalanceWithVersion(
  tx: Prisma.TransactionClient,
  userId: string,
  values: ResourceBalanceSnapshot,
  expectedVersion: number,
): Promise<UpsertResourceResult> {
  if (expectedVersion === 0) {
    try {
      const created = await tx.resourceBalance.create({ data: { userId, ...values, version: 1 } });
      return { kind: "OK", snapshot: toSnapshot(created), version: created.version };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && (err as { code: string }).code === "P2002") {
        const existing = await tx.resourceBalance.findUniqueOrThrow({ where: { userId } });
        return { kind: "VERSION_CONFLICT", current: toSnapshot(existing), version: existing.version };
      }
      throw err;
    }
  }

  const result = await tx.resourceBalance.updateMany({
    where: { userId, version: expectedVersion },
    data: { ...values, version: { increment: 1 } },
  });

  if (result.count === 0) {
    const current = await tx.resourceBalance.findUniqueOrThrow({ where: { userId } });
    return { kind: "VERSION_CONFLICT", current: toSnapshot(current), version: current.version };
  }

  const updated = await tx.resourceBalance.findUniqueOrThrow({ where: { userId } });
  return { kind: "OK", snapshot: toSnapshot(updated), version: updated.version };
}
