import { z } from "zod";
import { compareLocalDate, toEpochDay, CurrencyType } from "@/lib/calendar-math";
import { localDateSchema } from "./calendar-local-date";
import { expectedVersionSchema, idempotencyKeySchema } from "./calendar-series";

const MAX_SNAPSHOT_AMOUNT = 1_000_000_000;
const MAX_NOTE_LENGTH = 500;
/** One item per supported currency at most — a duplicate currencyType is a client bug, not a legitimate request. */
const MAX_ITEMS = Object.values(CurrencyType).length;
/** Same bound as statistics-query.ts's statisticsOverviewQuerySchema — a generous year, not unbounded. */
const MAX_HISTORY_RANGE_DAYS = 366;

const snapshotItemSchema = z
  .object({
    currencyType: z.nativeEnum(CurrencyType),
    /** An observed total balance — always non-negative, never a delta. */
    amount: z.number().int().min(0).max(MAX_SNAPSHOT_AMOUNT),
  })
  .strict();

/**
 * A currency simply absent from `items` means the user didn't (re-)enter
 * it this time — it is dropped from this date's snapshot, never coerced
 * to 0 (see resource-snapshot-repository.ts's full-replace upsert).
 */
export const putSnapshotRequestSchema = z
  .object({
    timezone: z.string().min(1).max(100),
    note: z.string().max(MAX_NOTE_LENGTH).nullable(),
    items: z.array(snapshotItemSchema).max(MAX_ITEMS),
    expectedVersion: expectedVersionSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict()
  .refine((body) => new Set(body.items.map((i) => i.currencyType)).size === body.items.length, {
    message: "duplicate currencyType in items",
    path: ["items"],
  });
export type PutSnapshotRequest = z.infer<typeof putSnapshotRequestSchema>;

export const deleteSnapshotRequestSchema = z
  .object({
    expectedVersion: expectedVersionSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();
export type DeleteSnapshotRequest = z.infer<typeof deleteSnapshotRequestSchema>;

export const snapshotHistoryQuerySchema = z
  .object({
    from: localDateSchema,
    to: localDateSchema,
  })
  .strict()
  .refine((query) => compareLocalDate(query.from, query.to) <= 0, {
    message: "from must be <= to",
    path: ["from"],
  })
  .refine((query) => toEpochDay(query.to) - toEpochDay(query.from) <= MAX_HISTORY_RANGE_DAYS, {
    message: `range must not exceed ${MAX_HISTORY_RANGE_DAYS} days`,
    path: ["to"],
  });
export type SnapshotHistoryQuery = z.infer<typeof snapshotHistoryQuerySchema>;
