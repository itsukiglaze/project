// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BannerFamily } from "@/config/gacha";
import { GoalFields } from "./goal-fields";

describe("GoalFields", () => {
  it("19. Stable explains that no specific character/W-Engine is guaranteed, and shows no copies input", () => {
    render(
      <GoalFields family={BannerFamily.STABLE} targetCopies="1" onChange={vi.fn()} />,
    );
    expect(screen.getByText(/не гарантирует конкретного персонажа или w-engine/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/количество копий/i)).not.toBeInTheDocument();
  });

  it("Exclusive Agent shows a copies input instead", () => {
    render(
      <GoalFields family={BannerFamily.EXCLUSIVE_AGENT} targetCopies="1" onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText(/количество копий/i)).toBeInTheDocument();
  });
});
