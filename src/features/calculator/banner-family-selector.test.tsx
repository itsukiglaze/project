// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BannerFamily } from "@/config/gacha";
import { BannerFamilySelector } from "./banner-family-selector";

describe("BannerFamilySelector", () => {
  it("labels the step as Шаг 1", () => {
    render(<BannerFamilySelector activeFamily={BannerFamily.EXCLUSIVE_AGENT} onChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /шаг 1\..*выберите тип баннера/i })).toBeInTheDocument();
  });

  it("renders all four banner families as real radio inputs sharing one group name", () => {
    render(<BannerFamilySelector activeFamily={BannerFamily.EXCLUSIVE_AGENT} onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    const names = new Set(radios.map((r) => (r as HTMLInputElement).name));
    expect(names.size).toBe(1);
  });

  it("marks the active family's radio as checked, not the others", () => {
    render(<BannerFamilySelector activeFamily={BannerFamily.W_ENGINE} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /w-engine/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /эксклюзивный агент/i })).not.toBeChecked();
  });

  it("shows a compact summary (Hard pity + Механика) for the selected banner", () => {
    render(<BannerFamilySelector activeFamily={BannerFamily.EXCLUSIVE_AGENT} onChange={vi.fn()} />);
    expect(screen.getByText("Hard pity:")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.getByText("Механика:")).toBeInTheDocument();
    expect(screen.getByText("50/50")).toBeInTheDocument();
  });

  it("uses the correct mechanism split per family — W-Engine is 75/25, not 50/50", () => {
    render(<BannerFamilySelector activeFamily={BannerFamily.W_ENGINE} onChange={vi.fn()} />);
    expect(screen.getByText("75/25")).toBeInTheDocument();
  });

  it("Bangboo's mechanism reads as a guarantee, not a featured split", () => {
    render(<BannerFamilySelector activeFamily={BannerFamily.BANGBOO} onChange={vi.fn()} />);
    expect(screen.getByText(/выбранная цель гарантирована/i)).toBeInTheDocument();
  });

  it("ties the guarantee explanation text to the currently selected banner", () => {
    render(<BannerFamilySelector activeFamily={BannerFamily.STABLE} onChange={vi.fn()} />);
    expect(screen.getByText(/без гарантии конкретного персонажа или w-engine/i)).toBeInTheDocument();
  });

  it("calls onChange with the clicked family", async () => {
    const onChange = vi.fn();
    render(<BannerFamilySelector activeFamily={BannerFamily.EXCLUSIVE_AGENT} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: /bangboo/i }));
    expect(onChange).toHaveBeenCalledWith(BannerFamily.BANGBOO);
  });

  it("supports keyboard navigation via native radio-group arrow keys", async () => {
    const onChange = vi.fn();
    render(<BannerFamilySelector activeFamily={BannerFamily.EXCLUSIVE_AGENT} onChange={onChange} />);
    const first = screen.getByRole("radio", { name: /эксклюзивный агент/i });
    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalled();
  });
});
