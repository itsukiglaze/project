// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiffPreview } from "./diff-preview";

const LABELS = { polychrome: "Полихромы", guaranteeActive: "Гарантия" };

describe("DiffPreview", () => {
  it("shows each changed field as previous → next", () => {
    render(
      <DiffPreview
        changes={[
          { field: "polychrome", previous: 0, next: 320 },
          { field: "guaranteeActive", previous: false, next: true },
        ]}
        labels={LABELS}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirming={false}
      />,
    );

    expect(screen.getByText("0 → 320")).toBeInTheDocument();
    expect(screen.getByText("нет → да")).toBeInTheDocument();
  });

  it("disables confirm when there are no changes", () => {
    render(
      <DiffPreview changes={[]} labels={LABELS} onConfirm={vi.fn()} onCancel={vi.fn()} confirming={false} />,
    );
    expect(screen.getByRole("button", { name: /подтвердить/i })).toBeDisabled();
  });

  it("calls onConfirm / onCancel", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DiffPreview
        changes={[{ field: "polychrome", previous: 0, next: 320 }]}
        labels={LABELS}
        onConfirm={onConfirm}
        onCancel={onCancel}
        confirming={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /подтвердить/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /отмена/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while confirming", () => {
    render(
      <DiffPreview
        changes={[{ field: "polychrome", previous: 0, next: 320 }]}
        labels={LABELS}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirming
      />,
    );
    expect(screen.getByRole("button", { name: /сохраняем/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /отмена/i })).toBeDisabled();
  });
});
