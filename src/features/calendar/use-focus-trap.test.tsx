// @vitest-environment jsdom
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFocusTrap } from "./use-focus-trap";

function TestDialog({
  onClose,
  active = true,
  useInitialFocusRef = false,
}: {
  onClose: () => void;
  active?: boolean;
  useInitialFocusRef?: boolean;
}) {
  const secondButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useFocusTrap<HTMLDivElement>(onClose, {
    active,
    initialFocusRef: useInitialFocusRef ? secondButtonRef : undefined,
  });

  return (
    <div ref={containerRef} role="dialog" aria-modal="true" aria-label="Test dialog" tabIndex={-1}>
      <button type="button">First</button>
      <button type="button" ref={secondButtonRef}>
        Second
      </button>
      <button type="button">Third</button>
    </div>
  );
}

function Harness({ initialFocusRef = false, active }: { initialFocusRef?: boolean; active?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Trigger
      </button>
      <button type="button">Background</button>
      {open && (
        <TestDialog onClose={() => setOpen(false)} active={active} useInitialFocusRef={initialFocusRef} />
      )}
    </div>
  );
}

describe("useFocusTrap", () => {
  it("moves focus to the first focusable element inside the container on mount", () => {
    render(<TestDialog onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("moves focus to the given initialFocusRef element instead, when provided", () => {
    render(<TestDialog onClose={vi.fn()} useInitialFocusRef />);
    expect(screen.getByRole("button", { name: "Second" })).toHaveFocus();
  });

  it("wraps Tab from the last focusable element back to the first", async () => {
    render(<TestDialog onClose={vi.fn()} />);
    screen.getByRole("button", { name: "Third" }).focus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable element back to the last", async () => {
    render(<TestDialog onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Third" })).toHaveFocus();
  });

  it("does not let Tab move focus to elements outside the container", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Trigger" }));
    screen.getByRole("button", { name: "Third" }).focus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Background" })).not.toHaveFocus();
  });

  it("calls onClose on Escape", async () => {
    const onClose = vi.fn();
    render(<TestDialog onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the previously focused element when the dialog closes", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Trigger" });
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("does nothing (no trap, no Escape handling) while active is false", async () => {
    const onClose = vi.fn();
    render(<TestDialog onClose={onClose} active={false} />);
    expect(screen.getByRole("button", { name: "First" })).not.toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});
