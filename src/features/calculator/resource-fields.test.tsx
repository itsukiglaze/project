// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BannerFamily, getBannerConfig } from "@/config/gacha";
import { ResourceFields } from "./resource-fields";
import { EMPTY_RESOURCE_FIELDS } from "./types";

function renderFor(family: BannerFamily) {
  return render(
    <ResourceFields
      family={family}
      config={getBannerConfig(family)}
      useSaved={false}
      onUseSavedChange={vi.fn()}
      values={EMPTY_RESOURCE_FIELDS}
      errors={{}}
      onChange={vi.fn()}
      onToggleIncludeMonochrome={vi.fn()}
    />,
  );
}

describe("ResourceFields", () => {
  it("1. Exclusive Agent shows the special cassette field, not the regular one", () => {
    renderFor(BannerFamily.EXCLUSIVE_AGENT);
    expect(screen.getByLabelText(/шифр-кассеты/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/обычные кассеты/i)).not.toBeInTheDocument();
  });

  it("2. Stable shows the regular cassette field, not the special one", () => {
    renderFor(BannerFamily.STABLE);
    expect(screen.getByLabelText(/обычные кассеты/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/шифр-кассеты/i)).not.toBeInTheDocument();
  });

  it("3. Bangboo shows only the Boopon field", () => {
    renderFor(BannerFamily.BANGBOO);
    expect(screen.getByLabelText(/boopon/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/полихромы/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/монокромы/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/кассеты/i)).not.toBeInTheDocument();
  });
});
