import { afterEach, describe, expect, it, vi } from "vitest";
import { BannerFamily } from "@/config/gacha";
import { submitCalculatorRequest, type CalculatorRequestPayload } from "./api";

const BASE_PAYLOAD: CalculatorRequestPayload = {
  family: BannerFamily.EXCLUSIVE_AGENT,
  targetCopies: 1,
  useSavedResources: true,
  useSavedBannerState: true,
};

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }),
  );
}

describe("submitCalculatorRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("20. recognizes a CALCULATED response", async () => {
    mockFetchOnce(200, {
      kind: "CALCULATED",
      firstTargetCost: 90,
      additionalTargetCost: 180,
      totalRequiredPulls: 90,
      availablePulls: 0,
      missingPulls: 90,
      missingPolychrome: 14400,
      leftoverPolychrome: 0,
      explanation: [],
    });
    const result = await submitCalculatorRequest(BASE_PAYLOAD);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.kind).toBe("CALCULATED");
    }
  });

  it("20. recognizes an UNSUPPORTED_TARGET response", async () => {
    mockFetchOnce(200, { kind: "UNSUPPORTED_TARGET", reason: "no featured guarantee" });
    const result = await submitCalculatorRequest(BASE_PAYLOAD);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.kind).toBe("UNSUPPORTED_TARGET");
    }
  });

  it("does not treat an HTTP 200 with an unrecognized body shape as success", async () => {
    mockFetchOnce(200, { unexpected: true });
    const result = await submitCalculatorRequest(BASE_PAYLOAD);
    expect(result.status).toBe("unknown_error");
  });

  it("maps HTTP 401 to auth_error", async () => {
    mockFetchOnce(401, { error: { code: "NOT_AUTHENTICATED", message: "login required" } });
    const result = await submitCalculatorRequest(BASE_PAYLOAD);
    expect(result.status).toBe("auth_error");
  });

  it("maps HTTP 400 to validation_error with fieldErrors", async () => {
    mockFetchOnce(400, {
      error: { code: "VALIDATION_ERROR", message: "bad input", fieldErrors: { family: ["invalid"] } },
    });
    const result = await submitCalculatorRequest(BASE_PAYLOAD);
    expect(result.status).toBe("validation_error");
    if (result.status === "validation_error") {
      expect(result.fieldErrors).toEqual({ family: ["invalid"] });
    }
  });

  it("maps a thrown fetch error to network_error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    const result = await submitCalculatorRequest(BASE_PAYLOAD);
    expect(result.status).toBe("network_error");
  });

  it("maps an AbortError to an 'aborted' status rather than a generic failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );
    const result = await submitCalculatorRequest(BASE_PAYLOAD);
    expect(result.status).toBe("aborted");
  });
});
