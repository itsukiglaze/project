import { describe, expect, it } from "vitest";
import { saveBannerStateRequestSchema } from "./banner-state";

const VALID = {
  sRankPity: 70,
  aRankPity: 2,
  guaranteeActive: true,
  expectedVersion: 1,
  idempotencyKey: "a-valid-key-12345",
};

describe("saveBannerStateRequestSchema", () => {
  it("accepts a valid shape with expectedVersion and idempotencyKey", () => {
    expect(saveBannerStateRequestSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects a request missing idempotencyKey (it is required)", () => {
    const withoutKey = { ...VALID };
    // @ts-expect-error - intentionally deleting a required field for the test
    delete withoutKey.idempotencyKey;
    expect(saveBannerStateRequestSchema.safeParse(withoutKey).success).toBe(false);
  });

  it("rejects a request missing expectedVersion (it is required)", () => {
    const withoutVersion = { ...VALID };
    // @ts-expect-error - intentionally deleting a required field for the test
    delete withoutVersion.expectedVersion;
    expect(saveBannerStateRequestSchema.safeParse(withoutVersion).success).toBe(false);
  });

  it("rejects a negative pity", () => {
    expect(saveBannerStateRequestSchema.safeParse({ ...VALID, sRankPity: -1 }).success).toBe(false);
  });

  it("rejects a fractional pity", () => {
    expect(saveBannerStateRequestSchema.safeParse({ ...VALID, sRankPity: 1.5 }).success).toBe(false);
  });

  it("rejects a non-boolean guaranteeActive", () => {
    expect(
      saveBannerStateRequestSchema.safeParse({ ...VALID, guaranteeActive: "yes" }).success,
    ).toBe(false);
  });

  it("rejects an unknown field, including a family field (route param is the only source)", () => {
    expect(
      saveBannerStateRequestSchema.safeParse({ ...VALID, family: "EXCLUSIVE_AGENT" }).success,
    ).toBe(false);
  });

  it("does NOT itself enforce the family-specific hard-pity bound (that's the service layer's job)", () => {
    // e.g. 90 is invalid for Exclusive Agent but this schema has no
    // family context, so it only checks "non-negative integer" here.
    expect(saveBannerStateRequestSchema.safeParse({ ...VALID, sRankPity: 90 }).success).toBe(true);
  });
});
