import type { ValidationResult } from "@/lib/gacha-math/types";
import type { BannerFamily } from "@/config/gacha";
import { CurrencyType, IncomeSource, TransactionType, type RecurringTransactionType } from "./types";

export type TransactionFields = {
  type: TransactionType;
  currencyType: CurrencyType | null;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
};

/**
 * Field-presence rules by transaction direction/kind:
 *  - INCOME: currencyType and source are required (source categorizes
 *    where the income came from — needed for later statistics); bannerFamily
 *    is not applicable.
 *  - EXPENSE: currencyType is required; source/bannerFamily are optional
 *    context, not required.
 *  - PULL: currencyType (what was spent) and bannerFamily (which banner)
 *    are both required; source is not applicable.
 *
 * This does not duplicate any gacha-math formula — it only checks field
 * presence, not pull/pity arithmetic.
 */
export function validateTransactionFieldsByType(
  fields: TransactionFields,
): ValidationResult<TransactionFields> {
  const errors: string[] = [];

  if (fields.type === TransactionType.INCOME) {
    if (!fields.currencyType) errors.push("currencyType is required for INCOME");
    if (!fields.source) errors.push("source is required for INCOME");
    if (fields.bannerFamily) errors.push("bannerFamily is not applicable for INCOME");
  } else if (fields.type === TransactionType.EXPENSE) {
    if (!fields.currencyType) errors.push("currencyType is required for EXPENSE");
    if (fields.source) errors.push("source is not applicable for EXPENSE");
  } else {
    // PULL
    if (!fields.currencyType) errors.push("currencyType is required for PULL");
    if (!fields.bannerFamily) errors.push("bannerFamily is required for PULL");
    if (fields.source) errors.push("source is not applicable for PULL");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: fields };
}

export type SeriesTemplate = {
  /** Recurring series are INCOME/EXPENSE only — PULL is rejected below. */
  type: RecurringTransactionType;
  currencyType: CurrencyType | null;
  /** Always a positive magnitude — `type` determines direction. */
  amount: number;
  source: IncomeSource | null;
  bannerFamily: BannerFamily | null;
  note: string | null;
};

const MAX_SERIES_AMOUNT = 1_000_000_000;

export function validateSeriesTemplate(template: SeriesTemplate): ValidationResult<SeriesTemplate> {
  const errors: string[] = [];

  if ((template.type as TransactionType) === TransactionType.PULL) {
    errors.push("PULL is not allowed for recurring series in MVP — record pulls as one-time transactions");
  }

  if (
    !Number.isInteger(template.amount) ||
    !Number.isSafeInteger(template.amount) ||
    template.amount <= 0
  ) {
    errors.push(`amount must be a positive safe integer, got ${String(template.amount)}`);
  }
  if (template.amount > MAX_SERIES_AMOUNT) {
    errors.push(`amount exceeds the maximum of ${MAX_SERIES_AMOUNT}`);
  }

  const fieldErrors = validateTransactionFieldsByType({
    type: template.type,
    currencyType: template.currencyType,
    source: template.source,
    bannerFamily: template.bannerFamily,
  });
  if (!fieldErrors.ok) errors.push(...fieldErrors.errors);

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: template };
}
