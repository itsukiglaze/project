// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingEmptyState } from "./onboarding-empty-state";

describe("OnboardingEmptyState", () => {
  it("shows the onboarding headline and explanation", () => {
    render(<OnboardingEmptyState onAddSource={vi.fn()} onAddOneTime={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Начните с источника дохода" })).toBeInTheDocument();
    expect(
      screen.getByText(/ежедневные задания, еженедельные награды, пропуск, события/i),
    ).toBeInTheDocument();
  });

  it("explains the source-to-calendar relationship", () => {
    render(<OnboardingEmptyState onAddSource={vi.fn()} onAddOneTime={vi.fn()} />);
    expect(
      screen.getByText(/будущие поступления появятся на календаре автоматически/i),
    ).toBeInTheDocument();
  });

  it("the primary action reuses the existing recurring-series creation flow", async () => {
    const onAddSource = vi.fn();
    render(<OnboardingEmptyState onAddSource={onAddSource} onAddOneTime={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Добавить источник" }));
    expect(onAddSource).toHaveBeenCalledTimes(1);
  });

  it("the secondary action opens the one-time-transaction flow", async () => {
    const onAddOneTime = vi.fn();
    render(<OnboardingEmptyState onAddSource={vi.fn()} onAddOneTime={onAddOneTime} />);
    await userEvent.click(screen.getByRole("button", { name: "Добавить разовое поступление" }));
    expect(onAddOneTime).toHaveBeenCalledTimes(1);
  });
});
