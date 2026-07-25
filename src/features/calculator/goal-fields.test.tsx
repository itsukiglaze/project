// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BannerFamily } from "@/config/gacha";
import { GoalFields } from "./goal-fields";

describe("GoalFields", () => {
  it("labels the step as Шаг 4", () => {
    render(<GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="1" onChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /шаг 4\..*что вы хотите получить/i })).toBeInTheDocument();
  });

  it("19. Stable explains that no specific character/W-Engine is guaranteed, and shows no goal chips", () => {
    render(<GoalFields family={BannerFamily.STABLE} targetCopies="1" onChange={vi.fn()} />);
    expect(screen.getByText(/не гарантирует конкретного персонажа или w-engine/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("Exclusive Agent (character banner) shows S0–S6 chips, not a plain numeric copies input", () => {
    render(<GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="1" onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/количество копий/i)).not.toBeInTheDocument();
    for (const label of ["S0", "S1", "S2", "S3", "S4", "S5", "S6"]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });

  it("S0 maps internally to 1 copy, and is checked when targetCopies is \"1\"", () => {
    render(<GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="1" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "S0" })).toBeChecked();
  });

  it("S6 maps internally to 7 copies, and is checked when targetCopies is \"7\"", () => {
    render(<GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="7" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "S6" })).toBeChecked();
  });

  it("clicking S2 calls onChange with \"3\" (S0=1, S1=2, S2=3, …)", async () => {
    const onChange = vi.fn();
    render(<GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="1" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "S2" }));
    expect(onChange).toHaveBeenCalledWith("3");
  });

  it("explains S0 vs S1–S6 for a character banner", () => {
    render(<GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="1" onChange={vi.fn()} />);
    expect(
      screen.getByText(/s0 — получить персонажа один раз\. s1–s6 — персонаж и дополнительные копии\./i),
    ).toBeInTheDocument();
  });

  it("W-Engine (non-character) uses copy-count terminology instead of S0–S6", () => {
    render(<GoalFields family={BannerFamily.W_ENGINE} targetCopies="1" onChange={vi.fn()} />);
    expect(screen.queryByRole("radio", { name: "S0" })).not.toBeInTheDocument();
    for (let copies = 1; copies <= 7; copies++) {
      expect(screen.getByRole("radio", { name: `Копия ${copies}` })).toBeInTheDocument();
    }
  });

  it("Bangboo also uses copy-count terminology, not S0–S6", () => {
    render(<GoalFields family={BannerFamily.BANGBOO} targetCopies="1" onChange={vi.fn()} />);
    expect(screen.queryByRole("radio", { name: "S0" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Копия 1" })).toBeInTheDocument();
  });

  it("all copy chips share one radio-group name (proper radio-group semantics)", () => {
    render(<GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="1" onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(7);
    const names = new Set(radios.map((r) => (r as HTMLInputElement).name));
    expect(names.size).toBe(1);
  });

  it("supports keyboard navigation between chips", async () => {
    const onChange = vi.fn();
    render(<GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="1" onChange={onChange} />);
    screen.getByRole("radio", { name: "S0" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("shows a validation error message associated with the group when present", () => {
    render(
      <GoalFields
        family={BannerFamily.EXCLUSIVE_AGENT}
        targetCopies=""
        onChange={vi.fn()}
        error="Минимум 1 копия"
      />,
    );
    expect(screen.getByText("Минимум 1 копия")).toBeInTheDocument();
  });
});
