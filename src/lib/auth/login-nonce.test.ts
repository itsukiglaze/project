import { describe, expect, it } from "vitest";
import { mintLoginNonce, verifyLoginNonce } from "./login-nonce";

const SECRET = "test-session-secret-not-real";

describe("login nonce round trip", () => {
  it("accepts a freshly minted nonce echoed back correctly", () => {
    const minted = mintLoginNonce(SECRET);
    const result = verifyLoginNonce({
      cookieValue: minted.cookieValue,
      submittedNonce: minted.nonce,
      secret: SECRET,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects when the cookie is missing entirely (no prior page load — classic CSRF shape)", () => {
    const minted = mintLoginNonce(SECRET);
    const result = verifyLoginNonce({
      cookieValue: undefined,
      submittedNonce: minted.nonce,
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MISSING_COOKIE");
  });

  it("rejects when the submitted nonce doesn't match the cookie's nonce", () => {
    const minted = mintLoginNonce(SECRET);
    const result = verifyLoginNonce({
      cookieValue: minted.cookieValue,
      submittedNonce: "attacker-guessed-or-different-nonce",
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NONCE_MISMATCH");
  });

  it("rejects a missing submitted nonce", () => {
    const minted = mintLoginNonce(SECRET);
    const result = verifyLoginNonce({
      cookieValue: minted.cookieValue,
      submittedNonce: undefined,
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NONCE_MISMATCH");
  });

  it("rejects a cookie value with a tampered signature (e.g. an attacker guessing at the format)", () => {
    const minted = mintLoginNonce(SECRET);
    const [nonce, expiresAt] = minted.cookieValue.split(".");
    const tampered = `${nonce}.${expiresAt}.0000000000000000000000000000000000000000000000000000000000000000`;
    const result = verifyLoginNonce({
      cookieValue: tampered,
      submittedNonce: nonce,
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("SIGNATURE_MISMATCH");
  });

  it("rejects a cookie signed with a different secret", () => {
    const minted = mintLoginNonce("a-completely-different-secret");
    const result = verifyLoginNonce({
      cookieValue: minted.cookieValue,
      submittedNonce: minted.nonce,
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("SIGNATURE_MISMATCH");
  });

  it("rejects a malformed cookie value (wrong shape)", () => {
    const result = verifyLoginNonce({
      cookieValue: "not-the-right-shape",
      submittedNonce: "anything",
      secret: SECRET,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MALFORMED_COOKIE");
  });

  it("rejects an expired nonce", () => {
    let clock = 1_000_000;
    const now = () => clock;
    const minted = mintLoginNonce(SECRET, now);
    clock += 6 * 60 * 1000; // 6 minutes later — past the 5-minute TTL
    const result = verifyLoginNonce({
      cookieValue: minted.cookieValue,
      submittedNonce: minted.nonce,
      secret: SECRET,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("accepts a nonce right at the edge of, but still within, its TTL", () => {
    let clock = 1_000_000;
    const now = () => clock;
    const minted = mintLoginNonce(SECRET, now);
    clock += 4 * 60 * 1000; // 4 minutes later — still within the 5-minute TTL
    const result = verifyLoginNonce({
      cookieValue: minted.cookieValue,
      submittedNonce: minted.nonce,
      secret: SECRET,
      now,
    });
    expect(result.ok).toBe(true);
  });

  it("mints a cryptographically random, sufficiently long nonce (not a predictable counter)", () => {
    const a = mintLoginNonce(SECRET);
    const b = mintLoginNonce(SECRET);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.nonce.length).toBeGreaterThanOrEqual(32);
  });
});
