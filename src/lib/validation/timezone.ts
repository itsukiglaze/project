/**
 * Telegram does NOT provide the user's timezone in `initDataUnsafe.user`.
 * The client determines it via:
 *
 *   Intl.DateTimeFormat().resolvedOptions().timeZone
 *
 * and sends it explicitly to the server. It is validated here; "UTC" is
 * used only as a fallback when the value is missing or invalid.
 */

export const FALLBACK_TIMEZONE = "UTC";

export function isValidIanaTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) {
    return false;
  }
  try {
    // Throws a RangeError for unknown zone names.
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(value: unknown): string {
  return isValidIanaTimezone(value) ? value : FALLBACK_TIMEZONE;
}
