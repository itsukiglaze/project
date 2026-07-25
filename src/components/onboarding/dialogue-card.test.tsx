// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingDialogueCard } from "./dialogue-card";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";

const welcomeStep = ONBOARDING_STEPS.find((s) => s.id === "welcome")!;
const settingsTabStep = ONBOARDING_STEPS.find((s) => s.id === "settings-tab")!;
const resourceBalanceStep = ONBOARDING_STEPS.find((s) => s.id === "resource-balance")!;

describe("OnboardingDialogueCard", () => {
  it("renders as an accessible dialog with title, body, and step progress", () => {
    render(
      <OnboardingDialogueCard
        step={welcomeStep}
        phase="step"
        stepIndex={0}
        totalSteps={7}
        onAdvance={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        position="bottom"
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(welcomeStep.title)).toBeInTheDocument();
    expect(screen.getByText(welcomeStep.body)).toBeInTheDocument();
    expect(screen.getAllByText("Шаг 1 из 7").length).toBeGreaterThan(0);
  });

  it("does not show a Back button on the first step", () => {
    render(
      <OnboardingDialogueCard
        step={welcomeStep}
        phase="step"
        stepIndex={0}
        totalSteps={7}
        onAdvance={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        position="bottom"
      />,
    );
    expect(screen.queryByRole("button", { name: "Назад" })).not.toBeInTheDocument();
  });

  it("shows a Back button after the first step and calls onBack", async () => {
    const onBack = vi.fn();
    render(
      <OnboardingDialogueCard
        step={settingsTabStep}
        phase="step"
        stepIndex={1}
        totalSteps={7}
        onAdvance={vi.fn()}
        onBack={onBack}
        onSkip={vi.fn()}
        position="bottom"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("shows the instruction line and no primary advance button while waiting for a real tap", () => {
    render(
      <OnboardingDialogueCard
        step={settingsTabStep}
        phase="step"
        stepIndex={1}
        totalSteps={7}
        onAdvance={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        position="bottom"
      />,
    );
    expect(screen.getByText(settingsTabStep.instruction!)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Далее" })).not.toBeInTheDocument();
  });

  it("shows the acknowledge button and calls onAdvance for a non-tap step", async () => {
    const onAdvance = vi.fn();
    render(
      <OnboardingDialogueCard
        step={welcomeStep}
        phase="step"
        stepIndex={0}
        totalSteps={7}
        onAdvance={onAdvance}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        position="bottom"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: welcomeStep.acknowledgeLabel! }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("shows the postActionAcknowledge title/body/button label during the post-action phase", () => {
    render(
      <OnboardingDialogueCard
        step={resourceBalanceStep}
        phase="post-action"
        stepIndex={2}
        totalSteps={7}
        onAdvance={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        position="bottom"
      />,
    );
    expect(screen.getByText(resourceBalanceStep.postActionAcknowledge!.body)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: resourceBalanceStep.postActionAcknowledge!.buttonLabel! }),
    ).toBeInTheDocument();
  });

  it("always shows a screen-reader description of the highlighted target when the step has one", () => {
    render(
      <OnboardingDialogueCard
        step={settingsTabStep}
        phase="step"
        stepIndex={1}
        totalSteps={7}
        onAdvance={vi.fn()}
        onBack={vi.fn()}
        onSkip={vi.fn()}
        position="bottom"
      />,
    );
    expect(screen.getByText(/Выделенный элемент:/)).toBeInTheDocument();
  });

  it("calls onSkip when Пропустить is clicked", async () => {
    const onSkip = vi.fn();
    render(
      <OnboardingDialogueCard
        step={welcomeStep}
        phase="step"
        stepIndex={0}
        totalSteps={7}
        onAdvance={vi.fn()}
        onBack={vi.fn()}
        onSkip={onSkip}
        position="bottom"
      />,
    );
    await userEvent.click(screen.getByText("Пропустить"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
