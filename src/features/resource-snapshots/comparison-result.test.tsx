// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrencyType } from "@/lib/calendar-math";
import { SnapshotComparisonResult } from "./comparison-result";
import type { ResourceSnapshotComparisonDto } from "./api";

function snapshot(overrides: Partial<ResourceSnapshotComparisonDto> = {}): ResourceSnapshotComparisonDto {
  return {
    record: {
      id: "snap-1",
      localDate: "2026-07-25",
      capturedAt: "2026-07-25T10:00:00.000Z",
      timezone: "UTC",
      note: null,
      items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }],
      version: 1,
    },
    comparison: [
      { currencyType: CurrencyType.POLYCHROME, current: 5420, previous: 5000, delta: 420, status: "positive" },
    ],
    previousLocalDate: "2026-07-24",
    ...overrides,
  };
}

describe("SnapshotComparisonResult", () => {
  it("shows 'Изменение с <date>' using the plain-Russian date format when a previous snapshot exists", () => {
    render(<SnapshotComparisonResult snapshot={snapshot()} />);
    expect(screen.getByRole("heading", { name: "Изменение с 24 июля" })).toBeInTheDocument();
  });

  it("shows the day gap ('Прошло N дней')", () => {
    render(<SnapshotComparisonResult snapshot={snapshot()} />);
    expect(screen.getByText("Прошло 1 день")).toBeInTheDocument();
  });

  it("uses the correct gap wording for a non-consecutive date, not 'со вчера'", () => {
    render(
      <SnapshotComparisonResult
        snapshot={snapshot({
          record: {
            id: "snap-1",
            localDate: "2026-07-25",
            capturedAt: "2026-07-25T10:00:00.000Z",
            timezone: "UTC",
            note: null,
            items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5420 }],
            version: 1,
          },
          previousLocalDate: "2026-07-20",
        })}
      />,
    );
    expect(screen.getByText("Прошло 5 дней")).toBeInTheDocument();
    expect(screen.queryByText(/вчера/i)).not.toBeInTheDocument();
  });

  it("shows the first-snapshot state and no day-gap line when there is no previous snapshot", () => {
    render(<SnapshotComparisonResult snapshot={snapshot({ previousLocalDate: null, comparison: [{ currencyType: CurrencyType.POLYCHROME, current: 300, status: "no_previous_snapshot" }] })} />);
    expect(screen.getByRole("heading", { name: "Первое сохранение" })).toBeInTheDocument();
    expect(screen.getByText("Первое сохранение — сравнивать пока не с чем.")).toBeInTheDocument();
    expect(screen.queryByText(/Прошло/)).not.toBeInTheDocument();
  });

  it("renders one row per currency, never merging amounts", () => {
    render(
      <SnapshotComparisonResult
        snapshot={snapshot({
          comparison: [
            { currencyType: CurrencyType.POLYCHROME, current: 5420, previous: 5000, delta: 420, status: "positive" },
            { currencyType: CurrencyType.BOOPON, current: 12, previous: 10, delta: 2, status: "positive" },
          ],
        })}
      />,
    );
    expect(screen.getByText("+420")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
