// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { SourceModeToggle } from "./source-mode-toggle";
import { GoalFields } from "./goal-fields";
import { ResourceFields } from "./resource-fields";
import { NumericField } from "./numeric-field";
import { EMPTY_RESOURCE_FIELDS } from "./types";

describe("calculator accessibility semantics", () => {
  it("SourceModeToggle renders two real radio inputs sharing one group name, distinct per instance", () => {
    render(
      <>
        <SourceModeToggle useSaved onChange={vi.fn()} groupName="resources-group" />
        <SourceModeToggle useSaved={false} onChange={vi.fn()} groupName="pity-group" />
      </>,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    const names = radios.map((r) => (r as HTMLInputElement).name);
    expect(new Set(names.slice(0, 2)).size).toBe(1);
    expect(new Set(names.slice(2, 4)).size).toBe(1);
    expect(names[0]).not.toBe(names[2]);
  });

  it("SourceModeToggle's selected option is marked checked and distinguished by more than colour (bold text)", () => {
    render(<SourceModeToggle useSaved onChange={vi.fn()} groupName="g" />);
    const saved = screen.getByRole("radio", { name: "Из профиля" });
    const manual = screen.getByRole("radio", { name: "Временные значения" });
    expect(saved).toBeChecked();
    expect(manual).not.toBeChecked();
    // The label wrapping the checked input gets a bold-weight class, not just a colour change.
    expect(saved.closest("label")?.className).toContain("has-[:checked]:font-bold");
  });

  it("GoalFields chip group exposes role=group with an accessible label for assistive tech", () => {
    render(<GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="1" onChange={vi.fn()} />);
    const group = screen.getByRole("group", { name: /желаемый результат/i });
    expect(group).toBeInTheDocument();
  });

  it("GoalFields ties the validation error to the group via aria-describedby", () => {
    render(
      <GoalFields
        family={BannerFamily.EXCLUSIVE_AGENT}
        targetCopies=""
        onChange={vi.fn()}
        error="Минимум 1 копия"
      />,
    );
    const group = screen.getByRole("group", { name: /желаемый результат/i });
    const describedBy = group.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent("Минимум 1 копия");
  });

  it("NumericField associates its label with the input via htmlFor/id", () => {
    render(<NumericField id="test-field" label="Тестовое поле" value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText("Тестовое поле");
    expect(input).toHaveAttribute("id", "test-field");
  });

  it("NumericField marks an invalid value with aria-invalid and wires aria-describedby to the visible error text", () => {
    render(
      <NumericField id="test-field" label="Тестовое поле" value="" onChange={vi.fn()} error="Обязательное поле" />,
    );
    const input = screen.getByLabelText("Тестовое поле");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent("Обязательное поле");
  });

  it("the resource 'include monochrome' checkbox has an accessible label from its wrapping <label>", () => {
    render(
      <ResourceFields
        family={BannerFamily.EXCLUSIVE_AGENT}
        config={getBannerConfig(BannerFamily.EXCLUSIVE_AGENT)}
        useSaved={false}
        onUseSavedChange={vi.fn()}
        values={EMPTY_RESOURCE_FIELDS}
        errors={{}}
        onChange={vi.fn()}
        onToggleIncludeMonochrome={vi.fn()}
        savedState={{ status: "loading" }}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: /учитывать монокромы как полихромы/i }),
    ).toBeInTheDocument();
  });

  it("banner cards, source toggles, and goal chips all keep visible focus-visible outline styling (not suppressed)", () => {
    render(<SourceModeToggle useSaved onChange={vi.fn()} groupName="g" />);
    const label = screen.getByRole("radio", { name: "Из профиля" }).closest("label");
    expect(label?.className).toContain("has-[:focus-visible]:outline");
  });
});
