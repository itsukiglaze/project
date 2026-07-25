// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrencyType } from "@/lib/calendar-math";
import { SnapshotForm } from "./snapshot-form";
import { HistoryList } from "./history-list";
import type { ResourceSnapshotComparisonDto } from "./api";

const TODAY = { year: 2026, month: 7, day: 25 };

/** Apple/Google's 44px minimum touch target, expressed via this codebase's min-h-11/h-11 convention (see calendar's mobile-interactions.test.tsx). */
function expectMinTouchTarget(element: Element) {
  expect(element.className).toMatch(/\b(min-h-11|h-11)\b/);
}

function assertNoFixedPixelWidths(container: HTMLElement) {
  for (const el of container.querySelectorAll<HTMLElement>("*")) {
    const className = el.className;
    if (typeof className !== "string") continue;
    expect(className).not.toMatch(/\bw-\[\d+px\]/);
  }
}

describe("resource-snapshots mobile layout", () => {
  it("SnapshotForm's Save/Cancel buttons and numeric inputs meet the 44px minimum", () => {
    render(
      <SnapshotForm today={TODAY} prefillItems={[]} submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expectMinTouchTarget(screen.getByRole("button", { name: /отмена/i }));
    expectMinTouchTarget(screen.getByRole("button", { name: /сохранить/i }));
    expectMinTouchTarget(screen.getByLabelText("Полихромы"));
    expectMinTouchTarget(screen.getByLabelText("Дата"));
  });

  it("SnapshotForm has no fixed pixel widths that would force horizontal scroll on a narrow screen", () => {
    const { container } = render(
      <SnapshotForm today={TODAY} prefillItems={[]} submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    assertNoFixedPixelWidths(container);
  });

  it("HistoryList's edit/delete buttons meet the 44px minimum", () => {
    const snapshot: ResourceSnapshotComparisonDto = {
      record: {
        id: "snap-1",
        localDate: "2026-07-25",
        capturedAt: "2026-07-25T10:00:00.000Z",
        timezone: "UTC",
        note: null,
        items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }],
        version: 1,
      },
      comparison: [{ currencyType: CurrencyType.POLYCHROME, current: 5000, status: "no_previous_snapshot" }],
      previousLocalDate: null,
    };
    render(<HistoryList snapshots={[snapshot]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) {
      expectMinTouchTarget(button);
    }
  });
});
