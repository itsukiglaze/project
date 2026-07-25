import type { CurrencyType } from "@/lib/calendar-math";

/** One currency's observed total within a snapshot — always a non-negative magnitude, never a delta. */
export type SnapshotCurrencyAmount = { currencyType: CurrencyType; amount: number };
