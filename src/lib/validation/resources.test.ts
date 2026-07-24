import { describe, expect, it } from "vitest";
import { saveResourcesRequestSchema } from "./resources";

const VALID = {
  polychrome: 320,
  monochrome: 0,
  encryptedMasterTape: 2,
  masterTape: 0,
  boopon: 0,
  expectedVersion: 1,
  idempotencyKey: "a-valid-key-12345",
};

describe("saveResourcesRequestSchema", () => {
  it("accepts a full valid snapshot with expectedVersion and idempotencyKey", () => {
    expect(saveResourcesRequestSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects a request missing idempotencyKey (it is required)", () => {
    const withoutKey = { ...VALID };
    // @ts-expect-error - intentionally deleting a required field for the test
    delete withoutKey.idempotencyKey;
    expect(saveResourcesRequestSchema.safeParse(withoutKey).success).toBe(false);
  });

  it("rejects an idempotencyKey that is too short", () => {
    expect(saveResourcesRequestSchema.safeParse({ ...VALID, idempotencyKey: "short" }).success).toBe(
      false,
    );
  });

  it("rejects an idempotencyKey with invalid characters", () => {
    expect(
      saveResourcesRequestSchema.safeParse({ ...VALID, idempotencyKey: "not valid! key" }).success,
    ).toBe(false);
  });

  it("rejects a request missing expectedVersion (it is required)", () => {
    const withoutVersion = { ...VALID };
    // @ts-expect-error - intentionally deleting a required field for the test
    delete withoutVersion.expectedVersion;
    expect(saveResourcesRequestSchema.safeParse(withoutVersion).success).toBe(false);
  });

  it("accepts expectedVersion = 0 (meaning 'no row yet')", () => {
    expect(saveResourcesRequestSchema.safeParse({ ...VALID, expectedVersion: 0 }).success).toBe(true);
  });

  it("rejects a negative value", () => {
    expect(saveResourcesRequestSchema.safeParse({ ...VALID, polychrome: -1 }).success).toBe(false);
  });

  it("rejects a fractional value", () => {
    expect(saveResourcesRequestSchema.safeParse({ ...VALID, polychrome: 1.5 }).success).toBe(false);
  });

  it("rejects a missing required resource field", () => {
    const withoutBoopon = { ...VALID };
    // @ts-expect-error - intentionally deleting a required field for the test
    delete withoutBoopon.boopon;
    expect(saveResourcesRequestSchema.safeParse(withoutBoopon).success).toBe(false);
  });

  it("rejects an unknown field (e.g. userId smuggled in)", () => {
    const result = saveResourcesRequestSchema.safeParse({ ...VALID, userId: "someone-else" });
    expect(result.success).toBe(false);
  });
});
