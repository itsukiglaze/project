import { createHash } from "crypto";

/**
 * Recursively sorts object keys so that two objects with the same
 * key/value pairs in a different insertion order canonicalize to the
 * identical structure before hashing. Arrays keep their order (order is
 * meaningful there); only plain object keys are sorted.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

/**
 * Stable SHA-256 hex digest of a request payload, independent of the
 * original object's key order.
 *
 * IMPORTANT: callers must hash the fully NORMALIZED payload (e.g. after
 * `guaranteeActive` normalization for Bangboo/Stable in
 * banner-state-service.ts) — hashing the raw client input would let two
 * requests that normalize to the exact same effective write be treated as
 * "different", defeating the point of normalization.
 */
export function computeRequestHash(payload: unknown): string {
  const canonicalJson = JSON.stringify(canonicalize(payload));
  return createHash("sha256").update(canonicalJson).digest("hex");
}
