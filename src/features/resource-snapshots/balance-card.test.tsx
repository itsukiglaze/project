// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurrencyType } from "@/lib/calendar-math";

const mockFetchLatestSnapshot = vi.fn();
const mockFetchSnapshotHistory = vi.fn();
const mockSaveSnapshot = vi.fn();
const mockDeleteSnapshot = vi.fn();

vi.mock("./api", () => ({
  fetchLatestSnapshot: (...args: unknown[]) => mockFetchLatestSnapshot(...args),
  fetchSnapshotHistory: (...args: unknown[]) => mockFetchSnapshotHistory(...args),
  saveSnapshot: (...args: unknown[]) => mockSaveSnapshot(...args),
  deleteSnapshot: (...args: unknown[]) => mockDeleteSnapshot(...args),
}));

vi.mock("@/features/calendar/local-date-client", () => ({
  getTodayLocalDate: () => ({ year: 2026, month: 7, day: 25 }),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "user-1", timezone: "UTC" },
  }),
}));

import { BalanceCard } from "./balance-card";

function snapshotFixture() {
  return {
    record: {
      id: "snap-1",
      localDate: "2026-07-24",
      capturedAt: "2026-07-24T09:00:00.000Z",
      timezone: "UTC",
      note: null,
      items: [{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }],
      version: 1,
    },
    comparison: [{ currencyType: CurrencyType.POLYCHROME, current: 5000, status: "no_previous_snapshot" }],
    previousLocalDate: null,
  };
}

describe("BalanceCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the first-snapshot empty state when there is no saved balance yet", async () => {
    mockFetchLatestSnapshot.mockResolvedValue({ status: "success", data: { snapshot: null } });
    render(<BalanceCard />);
    expect(
      await screen.findByText("Сохраните текущие ресурсы, чтобы отслеживать изменения между днями."),
    ).toBeInTheDocument();
  });

  it("shows the latest saved values when a snapshot exists", async () => {
    mockFetchLatestSnapshot.mockResolvedValue({ status: "success", data: { snapshot: snapshotFixture() } });
    render(<BalanceCard />);
    expect(await screen.findByText("5 000")).toBeInTheDocument();
    expect(screen.getByText("Полихромы")).toBeInTheDocument();
  });

  it("'Обновить баланс' opens the prefilled snapshot form", async () => {
    mockFetchLatestSnapshot.mockResolvedValue({ status: "success", data: { snapshot: snapshotFixture() } });
    render(<BalanceCard />);
    await screen.findByText("5 000");

    await userEvent.click(screen.getByRole("button", { name: "Обновить баланс" }));

    const dialog = await screen.findByRole("dialog", { name: "Обновить баланс" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("Полихромы")).toHaveValue("5000");
  });

  it("shows the after-save comparison once the form is submitted", async () => {
    mockFetchLatestSnapshot.mockResolvedValue({ status: "success", data: { snapshot: snapshotFixture() } });
    mockSaveSnapshot.mockResolvedValue({
      status: "success",
      data: {
        ok: true,
        snapshot: {
          record: {
            id: "snap-2",
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
        },
        replay: false,
      },
    });

    render(<BalanceCard />);
    await screen.findByText("5 000");
    await userEvent.click(screen.getByRole("button", { name: "Обновить баланс" }));
    await screen.findByRole("dialog", { name: "Обновить баланс" });

    const polychrome = screen.getByLabelText("Полихромы");
    await userEvent.clear(polychrome);
    await userEvent.type(polychrome, "5420");
    await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));

    expect(await screen.findByRole("heading", { name: "Изменение с 24 июля" })).toBeInTheDocument();
    expect(screen.getByText("+420")).toBeInTheDocument();
  });

  it("shows a contextual error and a retry action when the latest balance fails to load", async () => {
    mockFetchLatestSnapshot.mockResolvedValue({ status: "network_error" });
    render(<BalanceCard />);
    expect(await screen.findByText("Не удалось загрузить баланс ресурсов.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /повторить загрузку баланса/i })).toBeInTheDocument();
  });
});
