import type { ValidationResult } from "@/lib/gacha-math/types";
import {
  addDays,
  clampDayOfMonth,
  compareLocalDate,
  getDayOfWeek,
  type LocalDate,
} from "./local-date";
import { RecurrenceEndType, RecurrenceFrequency } from "./types";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  /** Every N days/weeks/months, depending on frequency. */
  interval: number;
  /** 0 (Sunday) .. 6 (Saturday), no duplicates. Required for WEEKLY only. */
  daysOfWeek: number[];
  /** 1..31. Required for MONTHLY only. Clamped per-month by expandRecurrence. */
  dayOfMonth: number | null;
  startDate: LocalDate;
  endType: RecurrenceEndType;
  /** Required iff endType = UNTIL_DATE. Must be >= startDate. */
  endDate: LocalDate | null;
  /** Required iff endType = AFTER_COUNT. Must be >= 1. */
  occurrenceCount: number | null;
};

/**
 * Safety backstop against a pathological rule (e.g. a tiny interval over
 * an enormous UNTIL_DATE/AFTER_COUNT span) — expandRecurrence always
 * terminates, even though in normal MVP usage the bounded forecast
 * horizon (see forecast.ts) makes this limit unreachable in practice.
 */
export const MAX_RECURRENCE_ITERATIONS = 100_000;

export function validateRecurrenceRule(rule: RecurrenceRule): ValidationResult<RecurrenceRule> {
  const errors: string[] = [];

  if (!Number.isInteger(rule.interval) || rule.interval < 1) {
    errors.push(`interval must be an integer >= 1, got ${String(rule.interval)}`);
  }

  if (rule.frequency === RecurrenceFrequency.WEEKLY) {
    if (rule.daysOfWeek.length === 0) {
      errors.push("daysOfWeek is required and must be non-empty for WEEKLY");
    } else {
      const seen = new Set<number>();
      for (const dow of rule.daysOfWeek) {
        if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
          errors.push(`daysOfWeek values must be integers in [0, 6], got ${String(dow)}`);
        } else if (seen.has(dow)) {
          errors.push(`daysOfWeek must not contain duplicates (duplicate: ${dow})`);
        } else {
          seen.add(dow);
        }
      }
    }
    if (rule.dayOfMonth !== null) {
      errors.push("dayOfMonth must be null for WEEKLY");
    }
  }

  if (rule.frequency === RecurrenceFrequency.MONTHLY) {
    if (rule.dayOfMonth === null) {
      errors.push("dayOfMonth is required for MONTHLY");
    } else if (!Number.isInteger(rule.dayOfMonth) || rule.dayOfMonth < 1 || rule.dayOfMonth > 31) {
      errors.push(`dayOfMonth must be an integer in [1, 31], got ${String(rule.dayOfMonth)}`);
    }
    if (rule.daysOfWeek.length > 0) {
      errors.push("daysOfWeek must be empty for MONTHLY");
    }
  }

  if (rule.frequency === RecurrenceFrequency.DAILY) {
    if (rule.daysOfWeek.length > 0) {
      errors.push("daysOfWeek must be empty for DAILY");
    }
    if (rule.dayOfMonth !== null) {
      errors.push("dayOfMonth must be null for DAILY");
    }
  }

  if (rule.endType === RecurrenceEndType.UNTIL_DATE) {
    if (!rule.endDate) {
      errors.push("endDate is required when endType is UNTIL_DATE");
    } else if (compareLocalDate(rule.endDate, rule.startDate) < 0) {
      errors.push("endDate must be >= startDate");
    }
    if (rule.occurrenceCount !== null) {
      errors.push("occurrenceCount must be null when endType is UNTIL_DATE");
    }
  } else if (rule.endType === RecurrenceEndType.AFTER_COUNT) {
    if (rule.occurrenceCount === null) {
      errors.push("occurrenceCount is required when endType is AFTER_COUNT");
    } else if (!Number.isInteger(rule.occurrenceCount) || rule.occurrenceCount < 1) {
      errors.push(`occurrenceCount must be an integer >= 1, got ${String(rule.occurrenceCount)}`);
    }
    if (rule.endDate !== null) {
      errors.push("endDate must be null when endType is AFTER_COUNT");
    }
  } else {
    if (rule.endDate !== null) errors.push("endDate must be null when endType is NEVER");
    if (rule.occurrenceCount !== null) errors.push("occurrenceCount must be null when endType is NEVER");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: rule };
}

/**
 * Expands a (caller-validated) recurrence rule into concrete occurrence
 * dates within [rangeStart, rangeEnd] (inclusive on both ends).
 *
 * Occurrence counting for AFTER_COUNT always starts from the rule's own
 * `startDate` — NOT from `rangeStart` — so a forecast window far in the
 * future still correctly reflects whether the series has already
 * exhausted its occurrence budget by then. This is why the loop below
 * walks from `startDate` even when `rangeStart` is later.
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  rangeStart: LocalDate,
  rangeEnd: LocalDate,
): LocalDate[] {
  if (compareLocalDate(rangeEnd, rangeStart) < 0) return [];

  const results: LocalDate[] = [];
  let occurrenceIndex = 0;
  let iterations = 0;

  function withinUntilDate(date: LocalDate): boolean {
    return rule.endType !== RecurrenceEndType.UNTIL_DATE || compareLocalDate(date, rule.endDate!) <= 0;
  }
  function withinCountLimit(): boolean {
    return rule.endType !== RecurrenceEndType.AFTER_COUNT || occurrenceIndex < (rule.occurrenceCount ?? 0);
  }

  /** Returns "stop" if the whole series is exhausted from this date on, else "continue". */
  function tryEmit(date: LocalDate): "continue" | "stop" {
    if (compareLocalDate(date, rule.startDate) < 0) return "continue"; // before series start: not a real occurrence
    if (!withinUntilDate(date)) return "stop";
    if (!withinCountLimit()) return "stop";
    occurrenceIndex += 1;
    if (compareLocalDate(date, rangeStart) >= 0 && compareLocalDate(date, rangeEnd) <= 0) {
      results.push(date);
    }
    return "continue";
  }

  if (rule.frequency === RecurrenceFrequency.DAILY) {
    let cursor = rule.startDate;
    while (iterations < MAX_RECURRENCE_ITERATIONS) {
      iterations += 1;
      if (tryEmit(cursor) === "stop") break;
      if (compareLocalDate(cursor, rangeEnd) > 0) break; // dates only increase from here
      cursor = addDays(cursor, rule.interval);
    }
  } else if (rule.frequency === RecurrenceFrequency.WEEKLY) {
    const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b);
    const startDow = getDayOfWeek(rule.startDate);
    const weekAnchor = addDays(rule.startDate, -startDow); // Sunday of the start week
    let weekIndex = 0;
    outer: while (iterations < MAX_RECURRENCE_ITERATIONS) {
      const weekStart = addDays(weekAnchor, weekIndex * rule.interval * 7);
      for (const dow of sortedDays) {
        iterations += 1;
        if (iterations >= MAX_RECURRENCE_ITERATIONS) break outer;
        const date = addDays(weekStart, dow);
        const action = tryEmit(date);
        if (action === "stop") break outer;
        if (compareLocalDate(date, rangeEnd) > 0) break outer; // ascending dow + ascending weeks -> safe to stop entirely
      }
      weekIndex += 1;
    }
  } else {
    // MONTHLY
    let monthIndex = 0;
    while (iterations < MAX_RECURRENCE_ITERATIONS) {
      iterations += 1;
      const totalMonths = rule.startDate.month - 1 + monthIndex * rule.interval;
      const year = rule.startDate.year + Math.floor(totalMonths / 12);
      const month = (((totalMonths % 12) + 12) % 12) + 1;
      const day = clampDayOfMonth(year, month, rule.dayOfMonth!);
      const date: LocalDate = { year, month, day };
      if (tryEmit(date) === "stop") break;
      if (compareLocalDate(date, rangeEnd) > 0) break;
      monthIndex += 1;
    }
  }

  return results;
}
