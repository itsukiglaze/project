import "server-only";
import { prisma } from "@/lib/db/prisma";
import { computeFieldDiff, type FieldChange } from "@/lib/diff";
import { computeRequestHash } from "@/lib/idempotency-hash";
import {
  getVersionedResourceBalance,
  upsertResourceBalanceWithVersion,
  type ResourceBalanceSnapshot,
} from "@/server/repositories/resource-balance-repository";
import {
  createIdempotencyRecord,
  isIdempotencyConflict,
  lookupIdempotencyRecord,
} from "@/server/repositories/idempotency-repository";
import { createAuditLog } from "@/server/repositories/audit-log-repository";

const ACTION = "SAVE_RESOURCES";

const DEFAULT_SNAPSHOT: ResourceBalanceSnapshot = {
  polychrome: 0,
  monochrome: 0,
  encryptedMasterTape: 0,
  masterTape: 0,
  boopon: 0,
};

export type SaveResourcesSuccess = {
  ok: true;
  previous: ResourceBalanceSnapshot;
  updated: ResourceBalanceSnapshot;
  changed: FieldChange<ResourceBalanceSnapshot>[];
  version: number;
  /** True if this response was served from a prior identical request (idempotency replay). */
  replay: boolean;
};

export type SaveResourcesConflict = {
  ok: false;
  kind: "STALE_STATE";
  current: ResourceBalanceSnapshot;
  currentVersion: number;
};

export type SaveResourcesKeyReused = {
  ok: false;
  kind: "IDEMPOTENCY_KEY_REUSED";
};

export type SaveResourcesResult = SaveResourcesSuccess | SaveResourcesConflict | SaveResourcesKeyReused;

/** What the idempotency key is bound to — the write target AND the version it was based on. */
function hashRequest(next: ResourceBalanceSnapshot, expectedVersion: number): string {
  return computeRequestHash({ ...next, expectedVersion });
}

/**
 * Persists a user's full resource-balance snapshot.
 *
 * Transactional: the balance upsert, its audit log entry, and the
 * idempotency record all happen in one `prisma.$transaction`.
 *
 * Optimistic concurrency: `expectedVersion` must be the version the
 * caller last read (0 means "I believe there's no row yet"). A mismatch
 * returns a typed STALE_STATE conflict.
 *
 * Request-bound idempotency: `idempotencyKey` is scoped to the EXACT
 * (normalized) payload it was issued for, via a canonical SHA-256 hash
 * (see lib/idempotency-hash.ts):
 *   - same key + same hash  -> replay the stored response, write nothing;
 *   - same key + different hash -> IDEMPOTENCY_KEY_REUSED conflict, since
 *     reusing a key for a different request is a client bug, not a retry;
 *   - expired record -> treated as absent, key is free to reuse.
 * If two requests with the SAME key+hash race each other, only one can
 * win the underlying DB unique constraint; the loser is caught
 * (isIdempotencyConflict) and made to replay the winner's result.
 */
export async function saveResources(
  userId: string,
  next: ResourceBalanceSnapshot,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<SaveResourcesResult> {
  const requestHash = hashRequest(next, expectedVersion);

  const lookup = await lookupIdempotencyRecord<SaveResourcesSuccess>(
    userId,
    ACTION,
    idempotencyKey,
    requestHash,
  );
  if (lookup.status === "match") {
    return { ...lookup.response, replay: true };
  }
  if (lookup.status === "mismatch") {
    return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };
  }

  const previousVersioned = await getVersionedResourceBalance(userId);
  const previous = previousVersioned
    ? { ...previousVersioned }
    : { ...DEFAULT_SNAPSHOT, version: 0 };
  const previousSnapshot: ResourceBalanceSnapshot = {
    polychrome: previous.polychrome,
    monochrome: previous.monochrome,
    encryptedMasterTape: previous.encryptedMasterTape,
    masterTape: previous.masterTape,
    boopon: previous.boopon,
  };
  const changed = computeFieldDiff(previousSnapshot, next);

  try {
    return await prisma.$transaction(async (tx) => {
      const upsertResult = await upsertResourceBalanceWithVersion(tx, userId, next, expectedVersion);

      if (upsertResult.kind === "VERSION_CONFLICT") {
        return {
          ok: false,
          kind: "STALE_STATE",
          current: upsertResult.current,
          currentVersion: upsertResult.version,
        };
      }

      if (changed.length > 0) {
        await createAuditLog(tx, userId, ACTION, {
          previous: previousSnapshot,
          updated: upsertResult.snapshot,
          changed,
        });
      }

      const response: SaveResourcesSuccess = {
        ok: true,
        previous: previousSnapshot,
        updated: upsertResult.snapshot,
        changed,
        version: upsertResult.version,
        replay: false,
      };

      await createIdempotencyRecord(tx, userId, ACTION, idempotencyKey, requestHash, response);

      return response;
    });
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      const winner = await lookupIdempotencyRecord<SaveResourcesSuccess>(
        userId,
        ACTION,
        idempotencyKey,
        requestHash,
      );
      if (winner.status === "match") return { ...winner.response, replay: true };
      if (winner.status === "mismatch") return { ok: false, kind: "IDEMPOTENCY_KEY_REUSED" };
    }
    throw err;
  }
}
