import { afterEach, describe, expect, it, vi } from "vitest";
import { createTransaction, fetchOccurrences, fetchSeriesList, updateSeries } from "./api";
import {
  CurrencyType,
  IncomeSource,
  RecurrenceEndType,
  RecurrenceFrequency,
  TransactionType,
} from "@/lib/calendar-math";

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body }),
  );
}

const D = { year: 2026, month: 1, day: 1 };
const TEMPLATE = {
  type: TransactionType.INCOME as const,
  currencyType: CurrencyType.POLYCHROME,
  amount: 1,
  source: IncomeSource.DAILY,
  bannerFamily: null,
  note: null,
};
const RULE = {
  frequency: RecurrenceFrequency.DAILY,
  interval: 1,
  daysOfWeek: [] as number[],
  dayOfMonth: null,
  startDate: "2026-01-01",
  endType: RecurrenceEndType.NEVER,
  endDate: null,
  occurrenceCount: null,
};

describe("calendar api client - error discrimination", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps HTTP 401 to auth_error", async () => {
    mockFetchOnce(401, { error: { code: "NOT_AUTHENTICATED", message: "login" } });
    const result = await fetchSeriesList();
    expect(result.status).toBe("auth_error");
  });

  it("maps HTTP 404 to not_found", async () => {
    mockFetchOnce(404, { error: { code: "NOT_FOUND", message: "gone" } });
    const result = await updateSeries("series-1", TEMPLATE, RULE, 1, "a-valid-key-12345");
    expect(result.status).toBe("not_found");
  });

  it("maps HTTP 409 STALE_STATE to stale_state with the current record", async () => {
    mockFetchOnce(409, { error: { code: "STALE_STATE", message: "stale" }, current: { version: 5 } });
    const result = await updateSeries("series-1", TEMPLATE, RULE, 1, "a-valid-key-12345");
    expect(result.status).toBe("stale_state");
    if (result.status === "stale_state") {
      expect((result.current as { version: number }).version).toBe(5);
    }
  });

  it("maps HTTP 409 IDEMPOTENCY_KEY_REUSED to idempotency_key_reused", async () => {
    mockFetchOnce(409, { error: { code: "IDEMPOTENCY_KEY_REUSED", message: "reused" } });
    const result = await createTransaction(
      {
        localDate: "2026-01-01",
        type: TransactionType.INCOME,
        currencyType: CurrencyType.POLYCHROME,
        amount: 1,
        source: IncomeSource.DAILY,
        bannerFamily: null,
        note: null,
        timezone: "UTC",
      },
      "a-valid-key-12345",
    );
    expect(result.status).toBe("idempotency_key_reused");
  });

  it("maps HTTP 422 to invalid_occurrence with errors", async () => {
    mockFetchOnce(422, {
      error: { code: "INVALID_OCCURRENCE", message: "bad", fieldErrors: { input: ["not scheduled"] } },
    });
    const result = await createTransaction(
      {
        localDate: "2026-01-01",
        type: TransactionType.INCOME,
        currencyType: CurrencyType.POLYCHROME,
        amount: 1,
        source: IncomeSource.DAILY,
        bannerFamily: null,
        note: null,
        timezone: "UTC",
      },
      "a-valid-key-12345",
    );
    expect(result.status).toBe("invalid_occurrence");
    if (result.status === "invalid_occurrence") {
      expect(result.errors).toEqual(["not scheduled"]);
    }
  });

  it("maps HTTP 400 to validation_error", async () => {
    mockFetchOnce(400, { error: { code: "VALIDATION_ERROR", message: "bad input", fieldErrors: {} } });
    const result = await fetchOccurrences(D, D);
    expect(result.status).toBe("validation_error");
  });

  it("maps a thrown fetch error to network_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
    const result = await fetchSeriesList();
    expect(result.status).toBe("network_error");
  });

  it("does not treat an unrecognized 200 body as success", async () => {
    mockFetchOnce(200, { unexpected: true });
    const result = await fetchSeriesList();
    expect(result.status).toBe("unknown_error");
  });

  it("recognizes a well-formed successful response", async () => {
    mockFetchOnce(200, { series: [] });
    const result = await fetchSeriesList();
    expect(result.status).toBe("success");
  });
});
