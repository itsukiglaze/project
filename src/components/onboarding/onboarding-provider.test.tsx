// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingProvider, useOnboarding } from "./onboarding-provider";
import { CURRENT_ONBOARDING_VERSION, ONBOARDING_STEPS } from "@/lib/onboarding/steps";

const mockUseAuth = vi.fn();
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

const persistOnboardingStatus = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/onboarding/api", () => ({
  persistOnboardingStatus: (...args: unknown[]) => persistOnboardingStatus(...args),
}));

function authed(overrides: { onboardingVersion: number | null; onboardingOutcome: "COMPLETED" | "SKIPPED" | null }) {
  return {
    status: "authenticated",
    user: {
      id: "u1",
      telegramId: "1",
      username: null,
      firstName: null,
      lastName: null,
      photoUrl: null,
      timezone: "UTC",
      ...overrides,
    },
  };
}

function Harness() {
  const onboarding = useOnboarding();
  return (
    <div>
      <div data-testid="is-open">{String(onboarding.isOpen)}</div>
      <div data-testid="launch-mode">{String(onboarding.launchMode)}</div>
      <div data-testid="step-index">{onboarding.currentStepIndex}</div>
      <div data-testid="step-id">{onboarding.currentStep?.id ?? "none"}</div>
      <div data-testid="phase">{onboarding.phase}</div>
      <div data-testid="is-confirming">{String(onboarding.isConfirmingClose)}</div>
      <div data-testid="toast">{onboarding.toastMessage ?? "none"}</div>
      <button onClick={() => onboarding.start("manual")}>start-manual</button>
      <button onClick={onboarding.advance}>advance</button>
      <button onClick={onboarding.back}>back</button>
      <button onClick={onboarding.skip}>skip</button>
      <button onClick={onboarding.requestClose}>request-close</button>
      <button onClick={onboarding.confirmClose}>confirm-close</button>
      <button onClick={onboarding.cancelClose}>cancel-close</button>
    </div>
  );
}

function renderHarness() {
  return render(
    <OnboardingProvider>
      <Harness />
    </OnboardingProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ status: "loading", user: null });
});

describe("OnboardingProvider auto-start", () => {
  it("auto-starts for a first-time user (onboardingVersion null)", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: null, onboardingOutcome: null }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));
    expect(screen.getByTestId("launch-mode")).toHaveTextContent("auto");
    expect(screen.getByTestId("step-id")).toHaveTextContent("welcome");
  });

  it("does not auto-start for a user who already completed the current version", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: CURRENT_ONBOARDING_VERSION, onboardingOutcome: "COMPLETED" }));
    renderHarness();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByTestId("is-open")).toHaveTextContent("false");
  });

  it("does not auto-start for a user who already skipped the current version", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: CURRENT_ONBOARDING_VERSION, onboardingOutcome: "SKIPPED" }));
    renderHarness();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByTestId("is-open")).toHaveTextContent("false");
  });

  it("auto-starts again for a user who completed an older version (version bump)", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: CURRENT_ONBOARDING_VERSION - 1, onboardingOutcome: "COMPLETED" }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));
  });

  it("does not auto-start while auth is still loading", async () => {
    mockUseAuth.mockReturnValue({ status: "loading", user: null });
    renderHarness();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByTestId("is-open")).toHaveTextContent("false");
  });
});

describe("OnboardingProvider manual restart", () => {
  it("starts at step 1 in manual mode regardless of persisted completion", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: CURRENT_ONBOARDING_VERSION, onboardingOutcome: "COMPLETED" }));
    renderHarness();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByTestId("is-open")).toHaveTextContent("false");

    await userEvent.click(screen.getByText("start-manual"));
    expect(screen.getByTestId("is-open")).toHaveTextContent("true");
    expect(screen.getByTestId("launch-mode")).toHaveTextContent("manual");
    expect(screen.getByTestId("step-index")).toHaveTextContent("0");
  });

  it("closing a manually-started tutorial does not persist anything", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: CURRENT_ONBOARDING_VERSION, onboardingOutcome: "COMPLETED" }));
    renderHarness();
    await userEvent.click(screen.getByText("start-manual"));
    await userEvent.click(screen.getByText("request-close"));
    expect(screen.getByTestId("is-confirming")).toHaveTextContent("true");
    await userEvent.click(screen.getByText("confirm-close"));

    expect(screen.getByTestId("is-open")).toHaveTextContent("false");
    expect(persistOnboardingStatus).not.toHaveBeenCalled();
  });
});

describe("OnboardingProvider skip/close/finish persistence", () => {
  it("skip persists SKIPPED and closes", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: null, onboardingOutcome: null }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));

    await userEvent.click(screen.getByText("skip"));
    expect(persistOnboardingStatus).toHaveBeenCalledWith(CURRENT_ONBOARDING_VERSION, "SKIPPED");
    expect(screen.getByTestId("is-open")).toHaveTextContent("false");
  });

  it("closing an automatically-started tutorial persists SKIPPED (prevents reopening every launch)", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: null, onboardingOutcome: null }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));

    await userEvent.click(screen.getByText("request-close"));
    await userEvent.click(screen.getByText("confirm-close"));
    expect(persistOnboardingStatus).toHaveBeenCalledWith(CURRENT_ONBOARDING_VERSION, "SKIPPED");
    expect(screen.getByTestId("is-open")).toHaveTextContent("false");
  });

  it("cancelClose resumes the tutorial without persisting anything", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: null, onboardingOutcome: null }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));

    await userEvent.click(screen.getByText("request-close"));
    await userEvent.click(screen.getByText("cancel-close"));
    expect(persistOnboardingStatus).not.toHaveBeenCalled();
    expect(screen.getByTestId("is-open")).toHaveTextContent("true");
    expect(screen.getByTestId("is-confirming")).toHaveTextContent("false");
  });

  it("advancing through every step persists COMPLETED exactly once at the end", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: null, onboardingOutcome: null }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));

    for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
      const stepBefore = screen.getByTestId("step-id").textContent;
      const step = ONBOARDING_STEPS.find((s) => s.id === stepBefore);
      await userEvent.click(screen.getByText("advance"));
      if (step?.postActionAcknowledge) {
        // First advance only reveals the post-action content; a second commits it.
        await userEvent.click(screen.getByText("advance"));
      }
    }

    expect(persistOnboardingStatus).toHaveBeenCalledWith(CURRENT_ONBOARDING_VERSION, "COMPLETED");
    expect(persistOnboardingStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("is-open")).toHaveTextContent("false");
  });

  it("repeated skip calls are idempotent (no crash, persists every time it's actually invoked)", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: null, onboardingOutcome: null }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));
    await userEvent.click(screen.getByText("skip"));
    expect(persistOnboardingStatus).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByText("start-manual"));
    await userEvent.click(screen.getByText("skip"));
    expect(persistOnboardingStatus).toHaveBeenCalledTimes(2);
    expect(persistOnboardingStatus).toHaveBeenNthCalledWith(2, CURRENT_ONBOARDING_VERSION, "SKIPPED");
  });
});

describe("OnboardingProvider step navigation", () => {
  it("back() reviews the previous step without persisting anything", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: null, onboardingOutcome: null }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));

    await userEvent.click(screen.getByText("advance")); // welcome -> settings-tab
    expect(screen.getByTestId("step-id")).toHaveTextContent("settings-tab");

    await userEvent.click(screen.getByText("back"));
    expect(screen.getByTestId("step-id")).toHaveTextContent("welcome");
    expect(persistOnboardingStatus).not.toHaveBeenCalled();
  });

  it("a postActionAcknowledge step requires a second advance to move to the next step", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: null, onboardingOutcome: null }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));

    await userEvent.click(screen.getByText("advance")); // welcome -> settings-tab
    await userEvent.click(screen.getByText("advance")); // settings-tab -> resource-balance
    expect(screen.getByTestId("step-id")).toHaveTextContent("resource-balance");

    await act(async () => {
      await userEvent.click(screen.getByText("advance")); // reveals post-action
    });
    expect(screen.getByTestId("step-id")).toHaveTextContent("resource-balance");
    expect(screen.getByTestId("phase")).toHaveTextContent("post-action");

    await userEvent.click(screen.getByText("advance")); // commits to next step
    expect(screen.getByTestId("step-id")).toHaveTextContent("calculator-tab");
    expect(screen.getByTestId("phase")).toHaveTextContent("step");
  });
});

describe("OnboardingProvider skip confirmation toast", () => {
  it("shows the confirmation toast after skip, and clears it after the auto-dismiss delay", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: null, onboardingOutcome: null }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));

    await act(async () => {
      screen.getByText("skip").click();
    });
    expect(screen.getByTestId("toast")).toHaveTextContent("Обучение можно снова открыть в настройках.");

    await act(async () => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.getByTestId("toast")).toHaveTextContent("none");
    vi.useRealTimers();
  });

  it("does not show a toast on the close-confirmation path (only the explicit Skip button)", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: null, onboardingOutcome: null }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));

    await userEvent.click(screen.getByText("request-close"));
    await userEvent.click(screen.getByText("confirm-close"));
    expect(screen.getByTestId("toast")).toHaveTextContent("none");
  });

  it("clears a stale toast when starting the tutorial again", async () => {
    mockUseAuth.mockReturnValue(authed({ onboardingVersion: null, onboardingOutcome: null }));
    renderHarness();
    await waitFor(() => expect(screen.getByTestId("is-open")).toHaveTextContent("true"));
    await userEvent.click(screen.getByText("skip"));
    expect(screen.getByTestId("toast")).not.toHaveTextContent("none");

    await userEvent.click(screen.getByText("start-manual"));
    expect(screen.getByTestId("toast")).toHaveTextContent("none");
  });
});
