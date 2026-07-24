import "server-only";
import { prisma } from "@/lib/db/prisma";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { validateBannerStateInput } from "@/lib/gacha-math";
import { computeFieldDiff, type FieldChange } from "@/lib/diff";
import { computeRequestHash } from "@/lib/idempotency-hash";
import {
  getVersionedBannerState,
  upsertBannerStateWithVersion,
  type BannerStateWriteValues,
} from "@/server/repositories/banner-state-repository";
import {
  createIdempotencyRecord,
  isIdempotencyConflict,
  lookupIdempotencyRecord,
} from "@/server/repositories/idempotency-repository";
import { createAuditLog } from "@/server/repositories/audit-log-repository";

const DEFAULT_STATE: BannerStateWriteValues = {
  sRankPity: 0,
  aRankPity: 0,
  guaranteeActive: false,
};

function actionFor(family: BannerFamily): string {
  return `SAVE_BANNER_STATE:${family}`;
}

/**
 * Bangboo's selected target is always guaranteed regardless of this flag
 * (see config.selectedTargetAlways), and Stable has no featured-guarantee
 * concept at all — for both, `guaranteeActive` is domain-meaningless.
 * Normalized to a fixed `false` so the persisted state stays a faithful
 * reflection of what actually matters for this family, and so two
 * requests differing only in this field for these families are treated
 * as identical for BOTH diffing and idempotency hashing.
 */
function normalizeGuaranteeActive(family: BannerFamily, value: boolean): boolean {
  const config = getBannerConfig(family);
  if (config.selectedTargetAlways || family === BannerFamily.STABLE) {
    return false;
  }
  return value;
}

/**
 * What the idempotency key is bound to — the write target (AFTER
 * normalization) AND the version it was based on.
 *
 * Hashing must happen strictly after normalization: two Bangboo requests
 * that only disagree on `guaranteeActive` (which has no effect on this
 * family) must hash identically, or a client retry/duplicate would be
 * misclassified as a "different request" and rejected as
 * IDEMPOTENCY_KEY_REUSED even though nothing meaningful changed.
 */
function hashRequest(
  normalizedNext: BannerStateWriteValues,
  expectedVersion: number,
): string {
  return computeRequestHash({ ...normalizedNext, expectedVersion });
}

export type SaveBannerStateSuccess = {
  ok: true;
  previous: BannerStateWriteValues;
  updated: BannerStateWriteValues;
  changed: FieldChange<BannerStateWriteValues>[];
  version: number;
  replay: boolean;
};

export type SaveBannerStateConflict = {
  ok: false;
  kind: "STALE_STATE";
  current: BannerStateWriteValues;
  currentVersion: number;
};

export type SaveBannerStateValidationError = { ok: false; kind: "VALIDATION_ERROR"; errors: string[] };

export type SaveBannerStateKeyReused = { ok: false; kind: "IDEMPOTENCY_KEY_REUSED" };

export type SaveBannerStateResult =
  | SaveBannerStateSuccess
  | SaveBannerStateConflict
  | SaveBannerStateValidationError
  | SaveBannerStateKeyReused;

/**
 * Persists a user's pity/guarantee state for one banner family.
 *
 * Re-validates the domain bounds via `validateBannerStateInput` from
 * lib/gacha-math. Transactional, optimistic-concurrency-checked, and
 * request-bound idempotent — see resource-service.ts's saveResources for
 * the full rationale; the shape here mirrors it, with the one addition
 * that `guaranteeActive` is normalized BEFORE both validation and hashing.
 */
export async function saveBannerState(
  userId: string,
  family: BannerFamily,
  rawNext: BannerStateWriteValues,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<SaveBannerStateResult> {
  const config = getBannerConfig(family);
  const action = actionFor(family);
  const next: BannerStateWriteValues = {
    ...rawNext,
    guaranteeActive: normalizeGuaranteeActive(family, rawNext.guaranteeActive),
  };
  const requestHash = hashRequest(next, expectedVersion);

  const lookup = await lookupIdempotencyRecord<SaveBannerStateSuccess>(
    userId,
    action,
    idempotencyKey,
    requestHash,
  );
  if (lookup.status === "match") {
    return { ...lookup.response, replay: true };
  }
  if (lookup.status === "mismatch") {
    return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };
  }

  const validation = validateBannerStateInput(
    { family, ...next },
    config.hardPityS,
    config.hardPityA,
  );
  if (!validation.ok) {
    return { ok: false, kind: "VALIDATION_ERROR", errors: validation.errors };
  }

  const previousVersioned = await getVersionedBannerState(userId, family);
  const previous: BannerStateWriteValues = previousVersioned
    ? {
        sRankPity: previousVersioned.sRankPity,
        aRankPity: previousVersioned.aRankPity,
        guaranteeActive: previousVersioned.guaranteeActive,
      }
    : DEFAULT_STATE;

  const changed = computeFieldDiff(previous, next);

  try {
    return await prisma.$transaction(async (tx) => {
      const upsertResult = await upsertBannerStateWithVersion(
        tx,
        userId,
        family,
        next,
        expectedVersion,
      );

      if (upsertResult.kind === "VERSION_CONFLICT") {
        return {
          ok: false,
          kind: "STALE_STATE",
          current: {
            sRankPity: upsertResult.current.sRankPity,
            aRankPity: upsertResult.current.aRankPity,
            guaranteeActive: upsertResult.current.guaranteeActive,
          },
          currentVersion: upsertResult.version,
        };
      }

      const updated: BannerStateWriteValues = {
        sRankPity: upsertResult.state.sRankPity,
        aRankPity: upsertResult.state.aRankPity,
        guaranteeActive: upsertResult.state.guaranteeActive,
      };

      if (changed.length > 0) {
        await createAuditLog(tx, userId, action, { previous, updated, changed });
      }

      const response: SaveBannerStateSuccess = {
        ok: true,
        previous,
        updated,
        changed,
        version: upsertResult.version,
        replay: false,
      };

      await createIdempotencyRecord(tx, userId, action, idempotencyKey, requestHash, response);

      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<SaveBannerStateSuccess>(
        userId,
        action,
        idempotencyKey,
        requestHash,
      );
      if (winner.status === "match") return { ...winner.response, replay: true };
      if (winner.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };
    }
    throw err;
  }
}
