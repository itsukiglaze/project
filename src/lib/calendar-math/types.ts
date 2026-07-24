/**
 * Mirrors the Prisma enums of the same names (identical string values by
 * design — see prisma/schema.prisma). Kept independent so calendar-math
 * stays Prisma-free and importable from pure unit tests without needing
 * the generated client. Bridging to Prisma's own enum types happens in
 * the repository layer (Stage 5B), the same pattern already used for
 * BannerFamily in src/server/repositories/banner-state-repository.ts.
 */

export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
  PULL = "PULL",
}

export enum CurrencyType {
  POLYCHROME = "POLYCHROME",
  ENCRYPTED_MASTER_TAPE = "ENCRYPTED_MASTER_TAPE",
  MASTER_TAPE = "MASTER_TAPE",
  BOOPON = "BOOPON",
  MONOCHROME = "MONOCHROME",
}

export enum IncomeSource {
  DAILY = "DAILY",
  EVENT = "EVENT",
  QUEST = "QUEST",
  ENDGAME = "ENDGAME",
  MAIL = "MAIL",
  PROMO_CODE = "PROMO_CODE",
  BATTLE_PASS = "BATTLE_PASS",
  MEMBERSHIP = "MEMBERSHIP",
  PURCHASE = "PURCHASE",
  OTHER = "OTHER",
}

export enum RecurrenceFrequency {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
}

export enum RecurrenceEndType {
  NEVER = "NEVER",
  UNTIL_DATE = "UNTIL_DATE",
  AFTER_COUNT = "AFTER_COUNT",
}

/** Recurring series templates only ever move money in one of two directions. */
export type RecurringTransactionType = TransactionType.INCOME | TransactionType.EXPENSE;
