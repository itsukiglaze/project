import { describe, expect, it } from "vitest";
import {
  CurrencyType,
  IncomeSource,
  RecurrenceEndType,
  RecurrenceFrequency,
  TransactionType,
} from "@/lib/calendar-math";
import {
  serializeExceptionRecord,
  serializeForecastResult,
  serializeLocalDate,
  serializeMergedOccurrence,
  serializeNullableLocalDate,
  serializeRecurrenceRule,
  serializeSeriesRecord,
  serializeTransactionRecord,
} from "./calendar-dto";

/**
 * True JSON round-trip tests: build a domain object containing real
 * LocalDate ({year,month,day}) objects, pass it through Response.json's
 * actual serialization path (JSON.stringify -> JSON.parse), and assert the
 * exact ISO "YYYY-MM-DD" string comes out — not the plain object.
 */
function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("serializeLocalDate", () => {
  it("formats a LocalDate as YYYY-MM-DD, zero-padded", () => {
    expect(serializeLocalDate({ year: 2026, month: 1, day: 5 })).toBe("2026-01-05");
  });

  it("survives a real JSON.stringify/parse round trip as a string, not {year,month,day}", () => {
    const wire = roundTrip({ date: serializeLocalDate({ year: 2026, month: 12, day: 31 }) });
    expect(wire.date).toBe("2026-12-31");
    expect(typeof wire.date).toBe("string");
  });
});

describe("serializeNullableLocalDate", () => {
  it("passes null through", () => {
    expect(serializeNullableLocalDate(null)).toBeNull();
  });

  it("formats a non-null LocalDate", () => {
    expect(serializeNullableLocalDate({ year: 2026, month: 7, day: 4 })).toBe("2026-07-04");
  });
});

describe("serializeRecurrenceRule", () => {
  it("serializes startDate/endDate LocalDate objects to strings", () => {
    const dto = serializeRecurrenceRule({
      frequency: RecurrenceFrequency.WEEKLY,
      interval: 1,
      daysOfWeek: [1, 3],
      dayOfMonth: null,
      startDate: { year: 2026, month: 1, day: 1 },
      endType: RecurrenceEndType.UNTIL_DATE,
      endDate: { year: 2026, month: 12, day: 31 },
      occurrenceCount: null,
    });
    expect(dto.startDate).toBe("2026-01-01");
    expect(dto.endDate).toBe("2026-12-31");

    const wire = roundTrip(dto);
    expect(wire.startDate).toBe("2026-01-01");
    expect(typeof wire.startDate).toBe("string");
  });

  it("keeps a null endDate null when endType is NEVER", () => {
    const dto = serializeRecurrenceRule({
      frequency: RecurrenceFrequency.DAILY,
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: null,
      startDate: { year: 2026, month: 1, day: 1 },
      endType: RecurrenceEndType.NEVER,
      endDate: null,
      occurrenceCount: null,
    });
    expect(dto.endDate).toBeNull();
  });
});

describe("serializeSeriesRecord", () => {
  it("serializes the nested rule's dates, leaving other fields untouched", () => {
    const dto = serializeSeriesRecord({
      id: "series-1",
      type: TransactionType.INCOME,
      currencyType: CurrencyType.POLYCHROME,
      amount: 60,
      source: IncomeSource.DAILY,
      bannerFamily: null,
      note: null,
      rule: {
        frequency: RecurrenceFrequency.MONTHLY,
        interval: 1,
        daysOfWeek: [],
        dayOfMonth: 15,
        startDate: { year: 2026, month: 6, day: 15 },
        endType: RecurrenceEndType.AFTER_COUNT,
        endDate: null,
        occurrenceCount: 12,
      },
      timezone: "Europe/Berlin",
      isActive: true,
      splitFromSeriesId: null,
      version: 1,
    });

    const wire = roundTrip(dto);
    expect(wire.rule.startDate).toBe("2026-06-15");
    expect(wire.rule.endDate).toBeNull();
    expect(wire.id).toBe("series-1");
    expect(wire.timezone).toBe("Europe/Berlin");
  });
});

describe("serializeExceptionRecord", () => {
  it("serializes occurrenceDate to a string", () => {
    const dto = serializeExceptionRecord({
      seriesId: "series-1",
      occurrenceDate: { year: 2026, month: 3, day: 8 },
      isCancelled: true,
      amountOverride: null,
      currencyTypeOverride: null,
      sourceOverride: null,
      bannerFamilyOverride: null,
      noteOverride: null,
      version: 1,
    });
    const wire = roundTrip(dto);
    expect(wire.occurrenceDate).toBe("2026-03-08");
    expect(typeof wire.occurrenceDate).toBe("string");
  });
});

describe("serializeTransactionRecord", () => {
  it("serializes localDate to a string and a null occurrenceDate stays null", () => {
    const dto = serializeTransactionRecord({
      id: "tx-1",
      localDate: { year: 2026, month: 1, day: 5 },
      type: TransactionType.INCOME,
      currencyType: CurrencyType.POLYCHROME,
      amount: 300,
      source: IncomeSource.EVENT,
      bannerFamily: null,
      note: null,
      seriesId: null,
      occurrenceDate: null,
      version: 1,
    });
    const wire = roundTrip(dto);
    expect(wire.localDate).toBe("2026-01-05");
    expect(wire.occurrenceDate).toBeNull();
    expect(wire.id).toBe("tx-1");
    expect(wire.version).toBe(1);
  });

  it("serializes a non-null occurrenceDate (a materialized series occurrence) to a string", () => {
    const dto = serializeTransactionRecord({
      id: "tx-2",
      localDate: { year: 2026, month: 1, day: 10 },
      type: TransactionType.INCOME,
      currencyType: CurrencyType.POLYCHROME,
      amount: 60,
      source: IncomeSource.DAILY,
      bannerFamily: null,
      note: null,
      seriesId: "series-1",
      occurrenceDate: { year: 2026, month: 1, day: 10 },
      version: 1,
    });
    expect(roundTrip(dto).occurrenceDate).toBe("2026-01-10");
  });
});

describe("serializeMergedOccurrence", () => {
  it("serializes an actual occurrence, preserving id/source/bannerFamily/note/version (needed to edit/delete it)", () => {
    const dto = serializeMergedOccurrence({
      kind: "actual",
      id: "tx-42",
      seriesId: null,
      occurrenceDate: null,
      localDate: { year: 2026, month: 1, day: 12 },
      type: TransactionType.INCOME,
      currencyType: CurrencyType.POLYCHROME,
      amount: 300,
      source: IncomeSource.EVENT,
      bannerFamily: null,
      note: "bonus",
      version: 3,
    });
    const wire = roundTrip(dto);
    if (wire.kind !== "actual") throw new Error("expected an actual occurrence");
    expect(wire.localDate).toBe("2026-01-12");
    expect(wire.id).toBe("tx-42");
    expect(wire.source).toBe("EVENT");
    expect(wire.note).toBe("bonus");
    expect(wire.version).toBe(3);
  });

  it("serializes a virtual occurrence's occurrenceDate to a string", () => {
    const dto = serializeMergedOccurrence({
      kind: "virtual",
      seriesId: "series-1",
      occurrenceDate: { year: 2026, month: 1, day: 10 },
      type: TransactionType.INCOME,
      currencyType: CurrencyType.POLYCHROME,
      amount: 60,
      source: IncomeSource.DAILY,
      bannerFamily: null,
      note: null,
    });
    const wire = roundTrip(dto);
    if (wire.kind !== "virtual") throw new Error("expected a virtual occurrence");
    expect(wire.occurrenceDate).toBe("2026-01-10");
    expect(typeof wire.occurrenceDate).toBe("string");
  });
});

describe("serializeForecastResult", () => {
  it("serializes rangeStart/rangeEnd, nested occurrence dates, and daily balance dates all at once", () => {
    const dto = serializeForecastResult({
      requestedHorizonDays: 30,
      effectiveHorizonDays: 30,
      rangeStart: { year: 2026, month: 1, day: 1 },
      rangeEnd: { year: 2026, month: 1, day: 31 },
      occurrences: [
        {
          kind: "virtual",
          seriesId: "series-1",
          occurrenceDate: { year: 2026, month: 1, day: 10 },
          type: TransactionType.INCOME,
          currencyType: CurrencyType.POLYCHROME,
          amount: 60,
          source: IncomeSource.DAILY,
          bannerFamily: null,
          note: null,
        },
      ],
      dailyBalances: [{ date: { year: 2026, month: 1, day: 5 }, netChange: 60, runningBalance: 160 }],
      projectedEndingBalance: 100,
    });

    const wire = roundTrip(dto);
    expect(wire.rangeStart).toBe("2026-01-01");
    expect(wire.rangeEnd).toBe("2026-01-31");
    const occurrence = wire.occurrences[0];
    if (occurrence.kind !== "virtual") throw new Error("expected a virtual occurrence");
    expect(occurrence.occurrenceDate).toBe("2026-01-10");
    expect(wire.dailyBalances[0].date).toBe("2026-01-05");
    expect(wire.projectedEndingBalance).toBe(100);
  });
});
