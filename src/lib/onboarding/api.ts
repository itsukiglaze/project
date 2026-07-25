export type OnboardingOutcome = "COMPLETED" | "SKIPPED";

/**
 * Persists the outcome of the user's latest onboarding attempt. Best-effort
 * and fire-and-forget by design: onboarding persistence failure must never
 * block the app, so callers always close the tutorial locally regardless of
 * whether this succeeds — worst case on failure is the tutorial auto-showing
 * again next launch, which is an acceptable degradation.
 */
export async function persistOnboardingStatus(version: number, outcome: OnboardingOutcome): Promise<void> {
  try {
    const response = await fetch("/api/me/onboarding", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, outcome }),
    });
    if (!response.ok) {
      console.error("persistOnboardingStatus: server rejected update", response.status);
    }
  } catch (err) {
    console.error("persistOnboardingStatus: network error", err);
  }
}
