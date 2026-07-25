import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCurrentUser = vi.fn();
const mockUpdateOnboardingStatus = vi.fn();

vi.mock("@/server/services/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));
vi.mock("@/server/repositories/user-repository", () => ({
  updateOnboardingStatus: (...args: unknown[]) => mockUpdateOnboardingStatus(...args),
}));

import { POST } from "./route";

const USER = { id: "user-1" };

function req(body: unknown) {
  return new NextRequest("https://example.com/api/me/onboarding", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/me/onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(USER);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const response = await POST(req({ version: 1, outcome: "COMPLETED" }));
    expect(response.status).toBe(401);
  });

  it("records COMPLETED at the given version (200)", async () => {
    mockUpdateOnboardingStatus.mockResolvedValue({ onboardingVersion: 1, onboardingOutcome: "COMPLETED" });
    const response = await POST(req({ version: 1, outcome: "COMPLETED" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ onboardingVersion: 1, onboardingOutcome: "COMPLETED" });
    expect(mockUpdateOnboardingStatus).toHaveBeenCalledWith("user-1", 1, "COMPLETED");
  });

  it("records SKIPPED at the given version", async () => {
    mockUpdateOnboardingStatus.mockResolvedValue({ onboardingVersion: 1, onboardingOutcome: "SKIPPED" });
    const response = await POST(req({ version: 1, outcome: "SKIPPED" }));
    expect(response.status).toBe(200);
    expect(mockUpdateOnboardingStatus).toHaveBeenCalledWith("user-1", 1, "SKIPPED");
  });

  it("is idempotent — repeating the exact same request just re-sets the same state (200 again)", async () => {
    mockUpdateOnboardingStatus.mockResolvedValue({ onboardingVersion: 1, onboardingOutcome: "COMPLETED" });
    await POST(req({ version: 1, outcome: "COMPLETED" }));
    const second = await POST(req({ version: 1, outcome: "COMPLETED" }));
    expect(second.status).toBe(200);
    expect(mockUpdateOnboardingStatus).toHaveBeenCalledTimes(2);
  });

  it("400s on an invalid outcome value", async () => {
    const response = await POST(req({ version: 1, outcome: "MAYBE" }));
    expect(response.status).toBe(400);
    expect(mockUpdateOnboardingStatus).not.toHaveBeenCalled();
  });

  it("400s on a missing version", async () => {
    const response = await POST(req({ outcome: "COMPLETED" }));
    expect(response.status).toBe(400);
  });

  it("rejects an unknown field (strict schema)", async () => {
    const response = await POST(req({ version: 1, outcome: "COMPLETED", userId: "someone-else" }));
    expect(response.status).toBe(400);
    expect(mockUpdateOnboardingStatus).not.toHaveBeenCalled();
  });

  it("400s on malformed JSON", async () => {
    const response = await POST(req("not json"));
    expect(response.status).toBe(400);
  });
});
