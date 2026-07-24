// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayCell } from "./day-cell";

const TODAY = { year: 2026, month: 1, day: 15 };

describe("DayCell", () => {
  it("calls onSelect with the cell's date when clicked", async () => {
    const onSelect = vi.fn();
    render(
      <DayCell
        cell={{ date: { year: 2026, month: 1, day: 5 }, isCurrentMonth: true }}
        today={TODAY}
        summary={null}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith({ year: 2026, month: 1, day: 5 });
  });

  it("shows a solid indicator for an actual occurrence and a hollow one for a virtual (forecast) occurrence", () => {
    const { container } = render(
      <DayCell
        cell={{ date: { year: 2026, month: 1, day: 5 }, isCurrentMonth: true }}
        today={TODAY}
        summary={{ income: 60, expense: 0, net: 60, hasActual: true, hasVirtual: true }}
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector(".bg-foreground")).toBeInTheDocument();
    expect(container.querySelector(".border-muted.bg-transparent")).toBeInTheDocument();
  });

  it("shows only the actual indicator when there is no virtual occurrence that day", () => {
    const { container } = render(
      <DayCell
        cell={{ date: { year: 2026, month: 1, day: 5 }, isCurrentMonth: true }}
        today={TODAY}
        summary={{ income: 60, expense: 0, net: 60, hasActual: true, hasVirtual: false }}
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector(".bg-foreground")).toBeInTheDocument();
    expect(container.querySelector(".border-muted.bg-transparent")).not.toBeInTheDocument();
  });

  it("does not render indicators for a day with no summary", () => {
    const { container } = render(
      <DayCell
        cell={{ date: { year: 2026, month: 1, day: 5 }, isCurrentMonth: true }}
        today={TODAY}
        summary={null}
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector(".bg-foreground")).not.toBeInTheDocument();
  });

  it("highlights today with a ring", () => {
    render(<DayCell cell={{ date: TODAY, isCurrentMonth: true }} today={TODAY} summary={null} onSelect={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("ring-2");
  });

  it("dims leading/trailing days from adjacent months", () => {
    render(
      <DayCell
        cell={{ date: { year: 2025, month: 12, day: 30 }, isCurrentMonth: false }}
        today={TODAY}
        summary={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button")).toHaveClass("opacity-40");
  });
});
