// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { ResourceFields } from "./resource-fields";
import { EMPTY_RESOURCE_FIELDS } from "./types";
import type { SavedResourceState } from "./use-saved-profile-snapshot";

function renderFor(
  family: BannerFamily,
  overrides: {
    useSaved?: boolean;
    savedState?: SavedResourceState;
  } = {},
) {
  return render(
    <ResourceFields
      family={family}
      config={getBannerConfig(family)}
      useSaved={overrides.useSaved ?? false}
      onUseSavedChange={vi.fn()}
      values={EMPTY_RESOURCE_FIELDS}
      errors={{}}
      onChange={vi.fn()}
      onToggleIncludeMonochrome={vi.fn()}
      savedState={overrides.savedState ?? { status: "loading" }}
    />,
  );
}

describe("ResourceFields", () => {
  it("labels the step as Шаг 2 with the new question-style heading", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT);
    expect(
      screen.getByRole("heading", { name: /шаг 2\..*какие ресурсы использовать/i }),
    ).toBeInTheDocument();
  });

  it("1. Exclusive Agent shows the special cassette field, not the regular one (manual mode)", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT);
    expect(screen.getByLabelText(/шифр-кассеты/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/обычные кассеты/i)).not.toBeInTheDocument();
  });

  it("2. Stable shows the regular cassette field, not the special one (manual mode)", () => {
    renderFor(BannerFamily.STABLE);
    expect(screen.getByLabelText(/обычные кассеты/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/шифр-кассеты/i)).not.toBeInTheDocument();
  });

  it("3. Bangboo shows only the Boopon field (manual mode)", () => {
    renderFor(BannerFamily.BANGBOO);
    expect(screen.getByLabelText(/boopon/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/полихромы/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/монокромы/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/кассеты/i)).not.toBeInTheDocument();
  });

  it("manual mode explains the values are temporary and not saved to the profile", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT);
    expect(screen.getByText(/временные.*не сохраняются в\s*профиль/i)).toBeInTheDocument();
  });

  it("saved mode shows a loading message while the snapshot is being fetched", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT, { useSaved: true, savedState: { status: "loading" } });
    expect(screen.getByText(/загружаем сохранённые данные/i)).toBeInTheDocument();
  });

  it("saved mode shows the short description and the real saved values, relevant to the selected banner", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT, {
      useSaved: true,
      savedState: {
        status: "available",
        snapshot: { polychrome: 1600, monochrome: 300, encryptedMasterTape: 5, masterTape: 0, boopon: 0, version: 2 },
      },
    });
    expect(
      screen.getByText(/используем последние сохранённые значения ресурсов из вашего профиля/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Полихромы:")).toBeInTheDocument();
    expect(screen.getByText("1 600")).toBeInTheDocument();
    expect(screen.getByText("Шифр-кассеты:")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    // Not relevant to this family's calculation summary — omitted, not just zero.
    expect(screen.queryByText("Обычные кассеты:")).not.toBeInTheDocument();
  });

  it("saved mode for Bangboo only shows Boopon in the summary", () => {
    renderFor(BannerFamily.BANGBOO, {
      useSaved: true,
      savedState: {
        status: "available",
        snapshot: { polychrome: 1600, monochrome: 300, encryptedMasterTape: 0, masterTape: 0, boopon: 42, version: 2 },
      },
    });
    expect(screen.getByText("Boopon:")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.queryByText("Полихромы:")).not.toBeInTheDocument();
  });

  it("saved mode shows the explicit fallback (never a silent zero) when profile data is unavailable, with a link to Settings", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT, { useSaved: true, savedState: { status: "unavailable" } });
    expect(
      screen.getByText(/сначала сохраните ресурсы в настройках или выберите «ввести вручную»/i),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /настройки/i });
    expect(link).toHaveAttribute("href", "/settings");
  });

  it("saved mode shows the same fallback when the snapshot fetch itself failed", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT, { useSaved: true, savedState: { status: "error" } });
    expect(
      screen.getByText(/сначала сохраните ресурсы в настройках или выберите «ввести вручную»/i),
    ).toBeInTheDocument();
  });
});
