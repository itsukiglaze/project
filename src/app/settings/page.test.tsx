// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "./page";

const start = vi.fn();
vi.mock("@/components/onboarding/onboarding-provider", () => ({
  useOnboarding: () => ({ start }),
}));

vi.mock("@/features/profile/resource-form", () => ({
  ResourceForm: () => <div data-testid="resource-form" />,
}));
vi.mock("@/features/profile/pity-form", () => ({
  PityForm: () => <div data-testid="pity-form" />,
}));

describe("SettingsPage", () => {
  it("renders a Помощь section with the restart-tutorial entry", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Помощь")).toBeInTheDocument();
    expect(screen.getByText("Интерактивный обзор основных функций.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Пройти обучение заново" })).toBeInTheDocument();
  });

  it("calls onboarding.start('manual') when the restart button is clicked", async () => {
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole("button", { name: "Пройти обучение заново" }));
    expect(start).toHaveBeenCalledWith("manual");
  });

  it("still renders the existing resource and pity forms (no regression)", () => {
    render(<SettingsPage />);
    expect(screen.getByTestId("resource-form")).toBeInTheDocument();
    expect(screen.getByTestId("pity-form")).toBeInTheDocument();
  });
});
