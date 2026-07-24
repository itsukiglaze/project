import { describe, expect, it } from "vitest";
import { BannerFamily } from "@/config/gacha";
import {
  validateSeriesTemplate,
  validateTransactionFieldsByType,
  type SeriesTemplate,
} from "./transaction-validation";
import { CurrencyType, IncomeSource, TransactionType } from "./types";

describe("validateTransactionFieldsByType", () => {
  it("INCOME requires currencyType and source", () => {
    const result = validateTransactionFieldsByType({
      type: TransactionType.INCOME,
      currencyType: null,
      source: null,
      bannerFamily: null,
    });
    expect(result.ok).toBe(false);
  });

  it("INCOME with currencyType+source and no bannerFamily is valid", () => {
    const result = validateTransactionFieldsByType({
      type: TransactionType.INCOME,
      currencyType: CurrencyType.POLYCHROME,
      source: IncomeSource.DAILY,
      bannerFamily: null,
    });
    expect(result.ok).toBe(true);
  });

  it("INCOME rejects a bannerFamily (not applicable)", () => {
    const result = validateTransactionFieldsByType({
      type: TransactionType.INCOME,
      currencyType: CurrencyType.POLYCHROME,
      source: IncomeSource.DAILY,
      bannerFamily: BannerFamily.EXCLUSIVE_AGENT,
    });
    expect(result.ok).toBe(false);
  });

  it("EXPENSE requires currencyType but not source", () => {
    expect(
      validateTransactionFieldsByType({
        type: TransactionType.EXPENSE,
        currencyType: null,
        source: null,
        bannerFamily: null,
      }).ok,
    ).toBe(false);

    expect(
      validateTransactionFieldsByType({
        type: TransactionType.EXPENSE,
        currencyType: CurrencyType.MASTER_TAPE,
        source: null,
        bannerFamily: null,
      }).ok,
    ).toBe(true);
  });

  it("EXPENSE rejects a source (not applicable)", () => {
    const result = validateTransactionFieldsByType({
      type: TransactionType.EXPENSE,
      currencyType: CurrencyType.MASTER_TAPE,
      source: IncomeSource.OTHER,
      bannerFamily: null,
    });
    expect(result.ok).toBe(false);
  });

  it("PULL requires currencyType and bannerFamily", () => {
    expect(
      validateTransactionFieldsByType({
        type: TransactionType.PULL,
        currencyType: null,
        source: null,
        bannerFamily: null,
      }).ok,
    ).toBe(false);

    expect(
      validateTransactionFieldsByType({
        type: TransactionType.PULL,
        currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE,
        source: null,
        bannerFamily: BannerFamily.EXCLUSIVE_AGENT,
      }).ok,
    ).toBe(true);
  });

  it("PULL rejects a source (not applicable)", () => {
    const result = validateTransactionFieldsByType({
      type: TransactionType.PULL,
      currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE,
      source: IncomeSource.OTHER,
      bannerFamily: BannerFamily.EXCLUSIVE_AGENT,
    });
    expect(result.ok).toBe(false);
  });
});

function baseTemplate(overrides: Partial<SeriesTemplate> = {}): SeriesTemplate {
  return {
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 60,
    source: IncomeSource.DAILY,
    bannerFamily: null,
    note: null,
    ...overrides,
  };
}

describe("validateSeriesTemplate", () => {
  it("accepts a valid INCOME template", () => {
    expect(validateSeriesTemplate(baseTemplate()).ok).toBe(true);
  });

  it("accepts a valid EXPENSE template", () => {
    const template = baseTemplate({
      type: TransactionType.EXPENSE,
      currencyType: CurrencyType.MASTER_TAPE,
      source: null,
    });
    expect(validateSeriesTemplate(template).ok).toBe(true);
  });

  it("rejects PULL — recurring series are income/expense only in MVP", () => {
    // @ts-expect-error - PULL is intentionally outside SeriesTemplate["type"], testing runtime rejection
    const template = baseTemplate({ type: TransactionType.PULL, source: null, bannerFamily: BannerFamily.BANGBOO });
    expect(validateSeriesTemplate(template).ok).toBe(false);
  });

  it("rejects amount <= 0", () => {
    expect(validateSeriesTemplate(baseTemplate({ amount: 0 })).ok).toBe(false);
    expect(validateSeriesTemplate(baseTemplate({ amount: -5 })).ok).toBe(false);
  });

  it("rejects a fractional amount", () => {
    expect(validateSeriesTemplate(baseTemplate({ amount: 60.5 })).ok).toBe(false);
  });

  it("rejects an unsafe/absurdly large amount", () => {
    expect(validateSeriesTemplate(baseTemplate({ amount: 10_000_000_000 })).ok).toBe(false);
  });

  it("propagates field-presence errors from validateTransactionFieldsByType", () => {
    const template = baseTemplate({ currencyType: null });
    const result = validateSeriesTemplate(template);
    expect(result.ok).toBe(false);
  });
});
