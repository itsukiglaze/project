/**
 * Parsing/validation for raw text-input values before they become numbers
 * in a request payload. This mirrors the *shape* of constraints already
 * enforced server-side (non-negative integers, pity < hardPity, copies >= 1)
 * — it does not reimplement any gacha formula, only input hygiene.
 */

const MAX_RESOURCE_VALUE = 1_000_000_000;
const MAX_TARGET_COPIES_UI = 7; // UI-only cap; the math core has no such limit.

export type FieldParseResult = { ok: true; value: number } | { ok: false; error: string };

/** Empty string is treated as "not entered yet", not as 0 — caller decides what that means. */
export function isEmptyField(raw: string): boolean {
  return raw.trim().length === 0;
}

export function parseNonNegativeInt(raw: string, max: number = MAX_RESOURCE_VALUE): FieldParseResult {
  if (isEmptyField(raw)) {
    return { ok: false, error: "Введите значение" };
  }
  if (!/^\d+$/.test(raw.trim())) {
    return { ok: false, error: "Только целое неотрицательное число" };
  }
  const value = Number(raw.trim());
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
    return { ok: false, error: "Число слишком велико" };
  }
  if (value > max) {
    return { ok: false, error: `Максимум ${max.toLocaleString("ru-RU")}` };
  }
  return { ok: true, value };
}

export function parsePity(raw: string, hardPity: number): FieldParseResult {
  const parsed = parseNonNegativeInt(raw, hardPity - 1);
  if (!parsed.ok) {
    if (parsed.error.startsWith("Максимум")) {
      return { ok: false, error: `От 0 до ${hardPity - 1}` };
    }
    return parsed;
  }
  if (parsed.value >= hardPity) {
    return { ok: false, error: `От 0 до ${hardPity - 1}` };
  }
  return parsed;
}

export function parseTargetCopies(raw: string): FieldParseResult {
  const parsed = parseNonNegativeInt(raw, MAX_TARGET_COPIES_UI);
  if (!parsed.ok) return parsed;
  if (parsed.value < 1) {
    return { ok: false, error: "Минимум 1 копия" };
  }
  return parsed;
}

export const MAX_TARGET_COPIES = MAX_TARGET_COPIES_UI;

/**
 * Converts an already-validated numeric field string to a number, WITHOUT
 * ever trusting `Number(x)` on its own.
 *
 * Callers (see build-request.ts) only use this after `getClientFieldErrors`
 * has confirmed the string parses to a safe non-negative integer — this is
 * a defense-in-depth assertion, not a second validation pass: if it ever
 * fires, that means a caller skipped validation, which is a programming
 * error worth surfacing loudly (a thrown error) rather than silently
 * sending an unsafe/NaN value to the API.
 */
export function toValidatedSafeInt(raw: string, fieldName: string): number {
  const trimmed = raw.trim();
  const value = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `toValidatedSafeInt: "${fieldName}" was not a validated non-negative safe integer (got "${raw}"). ` +
        "This indicates buildCalculatorRequestPayload was called without prior client-side validation.",
    );
  }
  return value;
}
