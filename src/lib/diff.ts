export type FieldChange<T, K extends keyof T = keyof T> = {
  field: K;
  previous: T[K];
  next: T[K];
};

/**
 * Compares two flat objects field-by-field and returns only the fields
 * whose value actually changed (strict equality). Order follows the keys
 * of `next`, so the diff reads in a stable, predictable order.
 */
export function computeFieldDiff<T extends Record<string, unknown>>(
  previous: T,
  next: T,
): FieldChange<T>[] {
  const changes: FieldChange<T>[] = [];
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (previous[key] !== next[key]) {
      changes.push({ field: key, previous: previous[key], next: next[key] });
    }
  }
  return changes;
}

export function hasAnyChange<T extends Record<string, unknown>>(previous: T, next: T): boolean {
  return computeFieldDiff(previous, next).length > 0;
}
