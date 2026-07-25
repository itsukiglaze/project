// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CurrencyType } from "@/lib/calendar-math";
import { SnapshotForm } from "./snapshot-form";

const TODAY = { year: 2026, month: 7, day: 25 };

describe("SnapshotForm", () => {
  it("prefills fields from the latest known values so the user doesn't need to retype them", () => {
    render(
      <SnapshotForm
        today={TODAY}
        prefillItems={[
          { currencyType: CurrencyType.POLYCHROME, amount: 5000 },
          { currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE, amount: 10 },
        ]}
        submitting={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Полихромы")).toHaveValue("5000");
    expect(screen.getByLabelText("Шифр-кассеты")).toHaveValue("10");
  });

  it("leaves currencies with no prior value blank, not defaulted to 0", () => {
    render(
      <SnapshotForm
        today={TODAY}
        prefillItems={[{ currencyType: CurrencyType.POLYCHROME, amount: 5000 }]}
        submitting={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Boopon")).toHaveValue("");
  });

  it("submits only the currencies with a value, and only changing what the user edited leaves the rest as prefilled", async () => {
    const onSubmit = vi.fn();
    render(
      <SnapshotForm
        today={TODAY}
        prefillItems={[
          { currencyType: CurrencyType.POLYCHROME, amount: 5000 },
          { currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE, amount: 10 },
        ]}
        submitting={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    const polychrome = screen.getByLabelText("Полихромы");
    await userEvent.clear(polychrome);
    await userEvent.type(polychrome, "5420");
    await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          { currencyType: CurrencyType.POLYCHROME, amount: 5420 },
          { currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE, amount: 10 },
        ]),
      }),
    );
  });

  it("clearing a previously-prefilled field drops that currency from the submission instead of sending 0", async () => {
    const onSubmit = vi.fn();
    render(
      <SnapshotForm
        today={TODAY}
        prefillItems={[
          { currencyType: CurrencyType.POLYCHROME, amount: 5000 },
          { currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE, amount: 10 },
        ]}
        submitting={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    await userEvent.clear(screen.getByLabelText("Шифр-кассеты"));
    await userEvent.click(screen.getByRole("button", { name: /сохранить/i }));

    const submittedItems = onSubmit.mock.calls[0][0].items;
    expect(submittedItems).not.toContainEqual(
      expect.objectContaining({ currencyType: CurrencyType.ENCRYPTED_MASTER_TAPE }),
    );
  });

  it("defaults the date to today", () => {
    render(
      <SnapshotForm today={TODAY} prefillItems={[]} submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByLabelText("Дата")).toHaveValue("2026-07-25");
  });

  it("disables Save until at least one currency has a value", () => {
    render(
      <SnapshotForm today={TODAY} prefillItems={[]} submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /сохранить/i })).toBeDisabled();
  });

  it("shows a validation error for a non-numeric value and keeps Save disabled", async () => {
    render(
      <SnapshotForm today={TODAY} prefillItems={[]} submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    const polychrome = screen.getByLabelText("Полихромы");
    await userEvent.type(polychrome, "abc");
    expect(screen.getByRole("button", { name: /сохранить/i })).toBeDisabled();
  });

  it("Cancel calls onCancel", async () => {
    const onCancel = vi.fn();
    render(
      <SnapshotForm today={TODAY} prefillItems={[]} submitting={false} onSubmit={vi.fn()} onCancel={onCancel} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /отмена/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
