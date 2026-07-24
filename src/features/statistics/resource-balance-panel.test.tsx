// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockFetchResourceSnapshot = vi.fn();

vi.mock("@/features/profile/api", () => ({
  fetchResourceSnapshot: (...args: unknown[]) => mockFetchResourceSnapshot(...args),
}));

import { ResourceBalancePanel } from "./resource-balance-panel";

describe("ResourceBalancePanel", () => {
  it("shows a loading skeleton while the balance is loading", () => {
    mockFetchResourceSnapshot.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ResourceBalancePanel />);
    expect(screen.queryByText(/текущий баланс ресурсов/i)).not.toBeInTheDocument();
  });

  it("shows an error state when the balance fails to load", async () => {
    mockFetchResourceSnapshot.mockResolvedValue({ status: "network_error" });
    render(<ResourceBalancePanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/не удалось загрузить баланс/i);
  });

  it("shows each currency independently, never as a combined/percentage figure", async () => {
    mockFetchResourceSnapshot.mockResolvedValue({
      status: "success",
      data: { polychrome: 1600, monochrome: 300, encryptedMasterTape: 5, masterTape: 2, boopon: 10, version: 1 },
    });
    render(<ResourceBalancePanel />);

    expect(await screen.findByText("1 600")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    // No combined/percentage figure anywhere (e.g. a "%" sign or a total).
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
