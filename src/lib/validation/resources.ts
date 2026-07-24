import { z } from "zod";

const MAX_RESOURCE_VALUE = 1_000_000_000;
/** Alphanumeric + hyphen/underscore only, matching a UUID/nanoid shape. */
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;

/**
 * Full resource-balance snapshot. This endpoint replaces the whole row
 * (not a partial patch) — the client is expected to have loaded the
 * current values first (GET /api/resources) and show a diff preview
 * before calling this.
 *
 * `idempotencyKey` is REQUIRED (a retried write must always be safe to
 * repeat), and `expectedVersion` implements optimistic concurrency: it
 * must be the version last read from GET /api/resources, so a write
 * against data that has since changed is rejected as a conflict instead
 * of silently clobbering it.
 */
export const saveResourcesRequestSchema = z
  .object({
    polychrome: z.number().int().min(0).max(MAX_RESOURCE_VALUE),
    monochrome: z.number().int().min(0).max(MAX_RESOURCE_VALUE),
    encryptedMasterTape: z.number().int().min(0).max(MAX_RESOURCE_VALUE),
    masterTape: z.number().int().min(0).max(MAX_RESOURCE_VALUE),
    boopon: z.number().int().min(0).max(MAX_RESOURCE_VALUE),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().regex(IDEMPOTENCY_KEY_PATTERN, "Некорректный формат idempotencyKey"),
  })
  .strict();

export type SaveResourcesRequest = z.infer<typeof saveResourcesRequestSchema>;
