// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("renders as an accessible modal dialog with the given title/message", () => {
    render(
      <ConfirmDialog title="Удалить?" message="Нельзя отменить." onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Удалить?")).toBeInTheDocument();
    expect(screen.getByText("Нельзя отменить.")).toBeInTheDocument();
  });

  it("moves focus to the confirm button on mount (focus management)", () => {
    render(<ConfirmDialog title="Удалить?" message="msg" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /подтвердить/i })).toHaveFocus();
  });

  it("prevents an accidental destructive action by requiring an explicit confirm click", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog title="Удалить?" message="msg" onConfirm={onConfirm} onCancel={vi.fn()} />);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /подтвердить/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Удалить?" message="msg" onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: /отмена/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Escape is pressed", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Удалить?" message="msg" onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("uses a custom confirm label when provided", () => {
    render(
      <ConfirmDialog
        title="Отменить вхождение?"
        message="msg"
        confirmLabel="Отменить вхождение"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Отменить вхождение" })).toBeInTheDocument();
  });
});
