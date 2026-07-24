// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditScopeDialog } from "./edit-scope-dialog";

describe("EditScopeDialog", () => {
  it("calls onSelect('THIS') for 'только это вхождение'", async () => {
    const onSelect = vi.fn();
    render(<EditScopeDialog onSelect={onSelect} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByText(/только это вхождение/i));
    expect(onSelect).toHaveBeenCalledWith("THIS");
  });

  it("calls onSelect('THIS_AND_FUTURE') for 'это и будущие вхождения'", async () => {
    const onSelect = vi.fn();
    render(<EditScopeDialog onSelect={onSelect} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByText(/это и будущие вхождения/i));
    expect(onSelect).toHaveBeenCalledWith("THIS_AND_FUTURE");
  });

  it("calls onSelect('ALL') for 'всю серию'", async () => {
    const onSelect = vi.fn();
    render(<EditScopeDialog onSelect={onSelect} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByText(/всю серию/i));
    expect(onSelect).toHaveBeenCalledWith("ALL");
  });

  it("calls onCancel without selecting a scope", async () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    render(<EditScopeDialog onSelect={onSelect} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: /^отмена$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders as an accessible modal", () => {
    render(<EditScopeDialog onSelect={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });
});
