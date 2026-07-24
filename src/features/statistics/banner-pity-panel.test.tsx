// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BannerFamily } from "@/config/gacha";

const mockFetchAllBannerStates = vi.fn();
const mockFetchResourceSnapshot = vi.fn();

vi.mock("@/features/profile/api", () => ({
  fetchAllBannerStates: (...args: unknown[]) => mockFetchAllBannerStates(...args),
  fetchResourceSnapshot: (...args: unknown[]) => mockFetchResourceSnapshot(...args),
}));

import { BannerPityPanel } from "./banner-pity-panel";

const BANNER_STATES = {
  status: "success",
  data: {
    bannerStates: [
      { family: BannerFamily.EXCLUSIVE_AGENT, sRankPity: 70, aRankPity: 5, guaranteeActive: false, version: 1 },
      { family: BannerFamily.W_ENGINE, sRankPity: 10, aRankPity: 2, guaranteeActive: true, version: 1 },
      { family: BannerFamily.STABLE, sRankPity: 20, aRankPity: 1, guaranteeActive: false, version: 1 },
      { family: BannerFamily.BANGBOO, sRankPity: 0, aRankPity: 0, guaranteeActive: false, version: 1 },
    ],
  },
};

const RESOURCES = {
  status: "success",
  data: { polychrome: 320, monochrome: 100, encryptedMasterTape: 1, masterTape: 0, boopon: 5, version: 1 },
};

describe("BannerPityPanel", () => {
  it("shows a loading skeleton while data is loading", () => {
    mockFetchAllBannerStates.mockReturnValue(new Promise(() => {}));
    mockFetchResourceSnapshot.mockReturnValue(new Promise(() => {}));
    render(<BannerPityPanel />);
    expect(screen.queryByText(/pity и гарантия/i)).not.toBeInTheDocument();
  });

  it("shows an error state if either fetch fails", async () => {
    mockFetchAllBannerStates.mockResolvedValue({ status: "network_error" });
    mockFetchResourceSnapshot.mockResolvedValue(RESOURCES);
    render(<BannerPityPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/не удалось загрузить состояние pity/i);
  });

  it("shows remaining-to-hard-pity and worst-case-for-first-copy for a guarantee-eligible family", async () => {
    mockFetchAllBannerStates.mockResolvedValue(BANNER_STATES);
    mockFetchResourceSnapshot.mockResolvedValue(RESOURCES);
    render(<BannerPityPanel />);

    const card = (await screen.findByText("Эксклюзивный агент")).closest("div")!;
    // hardPityS=90, sRankPity=70 -> remaining 20
    expect(within(card).getByText(/осталось круток до гарантированного s-ранга: 20/i)).toBeInTheDocument();
    // guaranteeActive=false -> worst case = remaining (20) + hardPityS (90) = 110
    expect(within(card).getByText(/худший случай для первой целевой копии: 110/i)).toBeInTheDocument();
  });

  it("shows Stable without a worst-case-for-target number, with an explanatory note instead", async () => {
    mockFetchAllBannerStates.mockResolvedValue(BANNER_STATES);
    mockFetchResourceSnapshot.mockResolvedValue(RESOURCES);
    render(<BannerPityPanel />);

    const card = (await screen.findByText("Stable")).closest("div")!;
    expect(within(card).queryByText(/худший случай для первой целевой копии/i)).not.toBeInTheDocument();
    expect(within(card).getByText(/не имеет механики гарантии featured-предмета/i)).toBeInTheDocument();
  });

  it("computes available pulls for Bangboo from Boopon only, never from Polychrome", async () => {
    mockFetchAllBannerStates.mockResolvedValue(BANNER_STATES);
    mockFetchResourceSnapshot.mockResolvedValue(RESOURCES);
    render(<BannerPityPanel />);

    const card = (await screen.findByText("Bangboo")).closest("div")!;
    // Bangboo draws only on Boopon (5), regardless of the 320 Polychrome available.
    expect(within(card).getByText(/доступно круток: 5/i)).toBeInTheDocument();
  });

  it("the Monochrome toggle folds Monochrome into the Polychrome-based pull count only once checked", async () => {
    mockFetchAllBannerStates.mockResolvedValue(BANNER_STATES);
    mockFetchResourceSnapshot.mockResolvedValue({
      status: "success",
      data: { polychrome: 320, monochrome: 200, encryptedMasterTape: 1, masterTape: 0, boopon: 5, version: 1 },
    });
    render(<BannerPityPanel />);

    const card = (await screen.findByText("W-Engine")).closest("div")!;
    // 320 Polychrome / 160 per pull = 2 pulls from Polychrome + 1 tape = 3, before toggling.
    expect(within(card).getByText(/доступно круток: 3/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: /учитывать монокромы/i }));

    // (320 + 200) / 160 = 3 pulls from Polychrome+Monochrome + 1 tape = 4.
    expect(within(card).getByText(/доступно круток: 4/i)).toBeInTheDocument();
  });
});
