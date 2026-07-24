import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { BannerFamily } from "@/config/gacha";
import type { BannerStateInput } from "@/lib/gacha-math/types";

// The domain BannerFamily (src/config/gacha.ts) and Prisma's generated
// BannerFamily enum share identical string values by design (see comments
// in prisma/schema.prisma). This cast is the single, explicit place where
// the two are bridged, so a future rename of either enum surfaces here.
function toPrismaBannerFamily(family: BannerFamily): never {
  return family as never;
}

export async function getBannerState(
  userId: string,
  family: BannerFamily,
): Promise<BannerStateInput | null> {
  const row = await prisma.bannerState.findUnique({
    where: {
      userId_bannerFamily: {
        userId,
        bannerFamily: toPrismaBannerFamily(family),
      },
    },
  });

  if (!row) return null;

  return {
    family,
    sRankPity: row.sRankPity,
    aRankPity: row.aRankPity,
    guaranteeActive: row.guaranteeActive,
  };
}

export type VersionedBannerState = BannerStateInput & { version: number };

/** Same as getBannerState, but also exposes the optimistic-concurrency version. */
export async function getVersionedBannerState(
  userId: string,
  family: BannerFamily,
): Promise<VersionedBannerState | null> {
  const row = await prisma.bannerState.findUnique({
    where: { userId_bannerFamily: { userId, bannerFamily: toPrismaBannerFamily(family) } },
  });
  if (!row) return null;
  return {
    family,
    sRankPity: row.sRankPity,
    aRankPity: row.aRankPity,
    guaranteeActive: row.guaranteeActive,
    version: row.version,
  };
}

export type BannerStateWriteValues = {
  sRankPity: number;
  aRankPity: number;
  guaranteeActive: boolean;
};

/**
 * Upserts a user's pity/guarantee state for one family, INSIDE the given
 * transaction client. Retained for callers that don't need optimistic
 * concurrency; prefer upsertBannerStateWithVersion for user-facing saves.
 */
export async function upsertBannerState(
  tx: Prisma.TransactionClient,
  userId: string,
  family: BannerFamily,
  values: BannerStateWriteValues,
): Promise<BannerStateInput> {
  const bannerFamily = toPrismaBannerFamily(family);
  const row = await tx.bannerState.upsert({
    where: { userId_bannerFamily: { userId, bannerFamily } },
    create: { userId, bannerFamily, ...values },
    update: values,
  });

  return {
    family,
    sRankPity: row.sRankPity,
    aRankPity: row.aRankPity,
    guaranteeActive: row.guaranteeActive,
  };
}

export type UpsertBannerStateResult =
  | { kind: "OK"; state: BannerStateInput; version: number }
  | { kind: "VERSION_CONFLICT"; current: BannerStateInput; version: number };

/**
 * Optimistic-concurrency-aware upsert — see
 * resource-balance-repository.ts's upsertResourceBalanceWithVersion for
 * the full rationale (same pattern: an atomic `WHERE version = expected`
 * inside a single `updateMany`).
 */
export async function upsertBannerStateWithVersion(
  tx: Prisma.TransactionClient,
  userId: string,
  family: BannerFamily,
  values: BannerStateWriteValues,
  expectedVersion: number,
): Promise<UpsertBannerStateResult> {
  const bannerFamily = toPrismaBannerFamily(family);

  if (expectedVersion === 0) {
    try {
      const created = await tx.bannerState.create({
        data: { userId, bannerFamily, ...values, version: 1 },
      });
      return {
        kind: "OK",
        state: {
          family,
          sRankPity: created.sRankPity,
          aRankPity: created.aRankPity,
          guaranteeActive: created.guaranteeActive,
        },
        version: created.version,
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && (err as { code: string }).code === "P2002") {
        const existing = await tx.bannerState.findUniqueOrThrow({
          where: { userId_bannerFamily: { userId, bannerFamily } },
        });
        return {
          kind: "VERSION_CONFLICT",
          current: {
            family,
            sRankPity: existing.sRankPity,
            aRankPity: existing.aRankPity,
            guaranteeActive: existing.guaranteeActive,
          },
          version: existing.version,
        };
      }
      throw err;
    }
  }

  const result = await tx.bannerState.updateMany({
    where: { userId, bannerFamily, version: expectedVersion },
    data: { ...values, version: { increment: 1 } },
  });

  if (result.count === 0) {
    const current = await tx.bannerState.findUniqueOrThrow({
      where: { userId_bannerFamily: { userId, bannerFamily } },
    });
    return {
      kind: "VERSION_CONFLICT",
      current: {
        family,
        sRankPity: current.sRankPity,
        aRankPity: current.aRankPity,
        guaranteeActive: current.guaranteeActive,
      },
      version: current.version,
    };
  }

  const updated = await tx.bannerState.findUniqueOrThrow({
    where: { userId_bannerFamily: { userId, bannerFamily } },
  });
  return {
    kind: "OK",
    state: {
      family,
      sRankPity: updated.sRankPity,
      aRankPity: updated.aRankPity,
      guaranteeActive: updated.guaranteeActive,
    },
    version: updated.version,
  };
}
