import { describe, expect, it } from "vitest";
import { CurrencyType, IncomeSource, TransactionType, type MergedOccurrence } from "@/lib/calendar-math";
import { buildStatisticsTimeline } from "./timeline";

const TODAY = { year: 2026, month: 1, day: 15 };
const RANGE_START = { year: 2026, month: 1, day: 13 };
const RANGE_END = { year: 2026, month: 1, day: 17 };

function actual(overrides: Partial<Extract<MergedOccurrence, { kind: "actual" }>> = {}): MergedOccurrence {
  return {
    kind: "actual",
    seriesId: null,
    occurrenceDate: null,
    localDate: TODAY,
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 100,
    ...overrides,
  };
}

function virtual(overrides: Partial<Extract<MergedOccurrence, { kind: "virtual" }>> = {}): MergedOccurrence {
  return {
    kind: "virtual",
    seriesId: "series-1",
    occurrenceDate: TODAY,
    type: TransactionType.INCOME,
    currencyType: CurrencyType.POLYCHROME,
    amount: 60,
    source: IncomeSource.DAILY,
    bannerFamily: null,
    note: null,
    ...overrides,
  };
}

describe("buildStatisticsTimeline", () => {
  it("produces one point per day in the range, even with no data", () => {
    const timeline = buildStatisticsTimeline({
      occurrences: [],
      today: TODAY,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    expect(timeline).toHaveLength(5); // 13,14,15,16,17
    expect(timeline.map((p) => p.date)).toEqual([
      { year: 2026, month: 1, day: 13 },
      { year: 2026, month: 1, day: 14 },
      TODAY,
      { year: 2026, month: 1, day: 16 },
      { year: 2026, month: 1, day: 17 },
    ]);
  });

  it("populates actualCumulativeNetPolychrome for dates <= today, and null after", () => {
    const timeline = buildStatisticsTimeline({
      occurrences: [actual({ localDate: RANGE_START, amount: 200 })],
      today: TODAY,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    for (const point of timeline) {
      const isPastOrToday = point.date.day <= TODAY.day;
      if (isPastOrToday) {
        expect(point.actualCumulativeNetPolychrome).toBe(200);
      } else {
        expect(point.actualCumulativeNetPolychrome).toBeNull();
      }
    }
  });

  it("populates projectedCumulativeNetPolychrome for dates >= today, and null before", () => {
    const timeline = buildStatisticsTimeline({
      occurrences: [virtual({ occurrenceDate: { year: 2026, month: 1, day: 16 }, amount: 60 })],
      today: TODAY,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    const before = timeline.find((p) => p.date.day === 14)!;
    const onToday = timeline.find((p) => p.date.day === 15)!;
    const after = timeline.find((p) => p.date.day === 17)!;

    expect(before.projectedCumulativeNetPolychrome).toBeNull();
    expect(onToday.projectedCumulativeNetPolychrome).toBe(0); // no scheduled income has landed yet at exactly today
    expect(after.projectedCumulativeNetPolychrome).toBe(60);
  });

  it("the projected line continues exactly from the actual line's value at today (one continuous trajectory)", () => {
    const timeline = buildStatisticsTimeline({
      occurrences: [
        actual({ localDate: RANGE_START, type: TransactionType.INCOME, amount: 500 }),
        virtual({ occurrenceDate: { year: 2026, month: 1, day: 16 }, type: TransactionType.EXPENSE, amount: 50 }),
      ],
      today: TODAY,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    const onToday = timeline.find((p) => p.date.day === 15)!;
    // The connecting point: both fields agree at exactly `today`.
    expect(onToday.actualCumulativeNetPolychrome).toBe(onToday.projectedCumulativeNetPolychrome);
    expect(onToday.actualCumulativeNetPolychrome).toBe(500);

    const dayAfter = timeline.find((p) => p.date.day === 17)!;
    expect(dayAfter.projectedCumulativeNetPolychrome).toBe(450); // continues from 500, minus the 50 expense
  });

  it("counts actual PULL transactions per day, without touching the Polychrome net line", () => {
    const timeline = buildStatisticsTimeline({
      occurrences: [
        actual({
          localDate: RANGE_START,
          type: TransactionType.PULL,
          currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE,
          amount: 1,
        }),
      ],
      today: TODAY,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    const day = timeline.find((p) => p.date.day === 13)!;
    expect(day.actualPulls).toBe(1);
    expect(day.actualCumulativeNetPolychrome).toBe(0); // pull never contributes to the Polychrome net
  });

  it("ignores non-Polychrome INCOME/EXPENSE for the cumulative net, but still counts them as raw amounts is NOT done for other currencies (Polychrome-only fields)", () => {
    const timeline = buildStatisticsTimeline({
      occurrences: [actual({ localDate: RANGE_START, currencyType: CurrencyType.MONOCHROME, amount: 1000 })],
      today: TODAY,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    const day = timeline.find((p) => p.date.day === 13)!;
    expect(day.actualIncomePolychrome).toBe(0);
    expect(day.actualCumulativeNetPolychrome).toBe(0);
  });

  it("scheduledPulls is always 0 (PULL is not recurring-eligible)", () => {
    const timeline = buildStatisticsTimeline({
      occurrences: [virtual()],
      today: TODAY,
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    expect(timeline.every((p) => p.scheduledPulls === 0)).toBe(true);
  });
});
