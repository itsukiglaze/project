// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingOverlay } from "./onboarding-overlay";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = MockResizeObserver;
window.matchMedia =
  window.matchMedia ??
  ((query: string) =>
    ({
      matches: false,
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList);

const welcomeStep = ONBOARDING_STEPS.find((s) => s.id === "welcome")!;
const settingsTabStep = ONBOARDING_STEPS.find((s) => s.id === "settings-tab")!;

let mockOnboarding: {
  isOpen: boolean;
  isConfirmingClose: boolean;
  currentStep: typeof welcomeStep | null;
  currentStepIndex: number;
  totalSteps: number;
  phase: "step" | "post-action";
  toastMessage: string | null;
  advance: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  skip: ReturnType<typeof vi.fn>;
  requestClose: ReturnType<typeof vi.fn>;
  confirmClose: ReturnType<typeof vi.fn>;
  cancelClose: ReturnType<typeof vi.fn>;
};

vi.mock("./onboarding-provider", () => ({
  useOnboarding: () => mockOnboarding,
}));

function resetMockOnboarding() {
  mockOnboarding = {
    isOpen: true,
    isConfirmingClose: false,
    currentStep: welcomeStep,
    currentStepIndex: 0,
    totalSteps: ONBOARDING_STEPS.length,
    phase: "step",
    toastMessage: null,
    advance: vi.fn(),
    back: vi.fn(),
    skip: vi.fn(),
    requestClose: vi.fn(),
    confirmClose: vi.fn(),
    cancelClose: vi.fn(),
  };
}

beforeEach(() => {
  resetMockOnboarding();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("OnboardingOverlay", () => {
  it("renders nothing when the tutorial is closed", () => {
    mockOnboarding.isOpen = false;
    const { container } = render(<OnboardingOverlay />);
    expect(container).toBeEmptyDOMElement();
  });

  it("still renders the skip confirmation toast even though the tutorial itself is closed", () => {
    mockOnboarding.isOpen = false;
    mockOnboarding.toastMessage = "Обучение можно снова открыть в настройках.";
    render(<OnboardingOverlay />);
    expect(screen.getByRole("status")).toHaveTextContent("Обучение можно снова открыть в настройках.");
  });

  it("renders a full-screen backdrop and the dialogue card for a step with no target (welcome)", () => {
    render(<OnboardingOverlay />);
    expect(screen.getByText(welcomeStep.title)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a 'searching' hint only after a short delay, not immediately", async () => {
    vi.useFakeTimers();
    mockOnboarding.currentStep = settingsTabStep;
    render(<OnboardingOverlay />);
    expect(screen.queryByText(/Ищем нужный элемент/)).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByText(/Ищем нужный элемент/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows the missing-target failure panel with Retry/Skip step/Close actions once the search times out", async () => {
    vi.useFakeTimers();
    mockOnboarding.currentStep = settingsTabStep;
    render(<OnboardingOverlay />);
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    expect(screen.getByText("Не удалось найти этот элемент.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Пропустить шаг" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Закрыть обучение" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("'Пропустить шаг' on the missing-target panel calls advance(), not skip() (skips only this step)", async () => {
    vi.useFakeTimers();
    mockOnboarding.currentStep = settingsTabStep;
    render(<OnboardingOverlay />);
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    vi.useRealTimers();
    await userEvent.click(screen.getByRole("button", { name: "Пропустить шаг" }));
    expect(mockOnboarding.advance).toHaveBeenCalledTimes(1);
    expect(mockOnboarding.skip).not.toHaveBeenCalled();
  });

  it("finds a real target already in the DOM, spotlights it, and detects a real click on it as the tap_target action", async () => {
    const targetButton = document.createElement("button");
    targetButton.setAttribute("data-onboarding-target", "settings-tab");
    targetButton.textContent = "Настройки";
    const realOnClick = vi.fn();
    targetButton.addEventListener("click", realOnClick);
    document.body.appendChild(targetButton);

    mockOnboarding.currentStep = settingsTabStep;
    render(<OnboardingOverlay />);

    await waitFor(() => expect(screen.getByText(settingsTabStep.instruction!)).toBeInTheDocument());

    await userEvent.click(targetButton);
    // The real click handler still fires — the overlay never blocks or
    // intercepts the actual interaction with the target.
    expect(realOnClick).toHaveBeenCalledTimes(1);
    // And the tutorial detects it as the step's completion.
    expect(mockOnboarding.advance).toHaveBeenCalledTimes(1);
  });

  it("moves the dialogue card to the top of the screen when the real target sits low in the viewport (e.g. the bottom nav), so the card never covers it", async () => {
    const targetButton = document.createElement("button");
    targetButton.setAttribute("data-onboarding-target", "settings-tab");
    targetButton.textContent = "Настройки";
    document.body.appendChild(targetButton);
    targetButton.getBoundingClientRect = () =>
      ({ top: window.innerHeight - 50, bottom: window.innerHeight, left: 300, right: 360, width: 60, height: 50, x: 300, y: window.innerHeight - 50, toJSON() {} }) as DOMRect;

    mockOnboarding.currentStep = settingsTabStep;
    render(<OnboardingOverlay />);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.className).toMatch(/top-\[/));
    expect(dialog.className).not.toMatch(/bottom-\[/);
  });

  it("clicking the darkened backdrop does nothing (blocked, no navigation/side effect)", async () => {
    render(<OnboardingOverlay />);
    const backdrop = document.querySelector(".bg-black\\/55") as HTMLElement;
    expect(backdrop).toBeInTheDocument();
    await userEvent.click(backdrop);
    expect(mockOnboarding.advance).not.toHaveBeenCalled();
    expect(mockOnboarding.skip).not.toHaveBeenCalled();
    expect(mockOnboarding.requestClose).not.toHaveBeenCalled();
  });

  it("Escape requests the close-confirmation", async () => {
    render(<OnboardingOverlay />);
    await userEvent.keyboard("{Escape}");
    expect(mockOnboarding.requestClose).toHaveBeenCalledTimes(1);
  });

  it("Пропустить (Skip) in the dialogue card calls skip()", async () => {
    render(<OnboardingOverlay />);
    await userEvent.click(screen.getByText("Пропустить"));
    expect(mockOnboarding.skip).toHaveBeenCalledTimes(1);
  });

  it("renders the close-confirmation dialog when isConfirmingClose is true, with the specified copy and actions", async () => {
    mockOnboarding.isConfirmingClose = true;
    render(<OnboardingOverlay />);
    expect(screen.getByText("Закрыть обучение?")).toBeInTheDocument();
    expect(screen.getByText("Его можно снова пройти в настройках.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Продолжить" }));
    expect(mockOnboarding.cancelClose).toHaveBeenCalledTimes(1);
  });

  it("renders the character asset exactly as provided (no alt text, correct src), positioned decoratively", () => {
    render(<OnboardingOverlay />);
    const characterImg = document.querySelector('img[src*="guide-character"]') as HTMLImageElement;
    expect(characterImg).toBeInTheDocument();
    expect(characterImg.alt).toBe("");
  });

  it("suppresses Tab-reachability of unrelated background controls while the tutorial is open", async () => {
    const backgroundButton = document.createElement("button");
    backgroundButton.textContent = "Background action";
    document.body.appendChild(backgroundButton);

    render(<OnboardingOverlay />);
    await waitFor(() => expect(backgroundButton).toHaveAttribute("tabindex", "-1"));
  });

  it("restores original tabindex on unrelated controls once the tutorial closes", async () => {
    const backgroundButton = document.createElement("button");
    backgroundButton.textContent = "Background action";
    document.body.appendChild(backgroundButton);

    const { rerender } = render(<OnboardingOverlay />);
    await waitFor(() => expect(backgroundButton).toHaveAttribute("tabindex", "-1"));

    mockOnboarding.isOpen = false;
    rerender(<OnboardingOverlay />);
    await waitFor(() => expect(backgroundButton).not.toHaveAttribute("tabindex"));
  });
});
