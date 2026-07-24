// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BannerFamily } from "@/config/gacha";
import { CurrencyType, IncomeSource } from "@/lib/calendar-math";
import { TransactionTrendsPanel } from "./transaction-trends-panel";

describe("TransactionTrendsPanel", () => {
  it("shows an empty-state message when there is no source/banner data", () => {
    render(<TransactionTrendsPanel bySource={[]} byBannerFamily={[]} />);
    expect(screen.getByText(/нет фактического дохода/i)).toBeInTheDocument();
    expect(screen.getByText(/нет фактических круток/i)).toBeInTheDocument();
  });

  it("shows income grouped by (source, currency), never blending currencies within a source", () => {
    render(
      <TransactionTrendsPanel
        bySource={[
          { source: IncomeSource.DAILY, currency: CurrencyType.POLYCHROME, amount: 60 },
          { source: IncomeSource.DAILY, currency: CurrencyType.MONOCHROME, amount: 10 },
        ]}
        byBannerFamily={[]}
      />,
    );
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("shows pull counts grouped by banner family, as counts not currency amounts", () => {
    render(
      <TransactionTrendsPanel
        bySource={[]}
        byBannerFamily={[
          { bannerFamily: BannerFamily.BANGBOO, currency: CurrencyType.BOOPON, pulls: 4 },
        ]}
      />,
    );
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(BannerFamily.BANGBOO)).toBeInTheDocument();
  });

  it("each table has an accessible caption describing its content", () => {
    render(
      <TransactionTrendsPanel
        bySource={[{ source: IncomeSource.DAILY, currency: CurrencyType.POLYCHROME, amount: 60 }]}
        byBannerFamily={[{ bannerFamily: BannerFamily.BANGBOO, currency: CurrencyType.BOOPON, pulls: 1 }]}
      />,
    );
    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(2);
    for (const table of tables) {
      expect(table.querySelector("caption")).not.toBeNull();
    }
  });
});
