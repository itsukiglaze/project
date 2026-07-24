// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumericField } from "./numeric-field";

/**
 * NumericField is a controlled input — to test multi-keystroke typing
 * realistically (so values actually accumulate across keystrokes instead
 * of resetting every render), it needs to be driven by real React state,
 * not a bare mock that never updates the `value` prop back.
 */
function StatefulNumericField({
  initialValue = "",
  onChangeSpy,
}: {
  initialValue?: string;
  onChangeSpy: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <NumericField
      id="amount"
      label="Amount"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChangeSpy(next);
      }}
    />
  );
}

function setup(initialValue = "") {
  const onChangeSpy = vi.fn();
  render(<StatefulNumericField initialValue={initialValue} onChangeSpy={onChangeSpy} />);
  return { input: screen.getByLabelText("Amount") as HTMLInputElement, onChangeSpy };
}

describe("NumericField", () => {
  it("11. accepts an empty value without coercing to 0", async () => {
    const { input, onChangeSpy } = setup("5");
    await userEvent.clear(input);
    expect(onChangeSpy).toHaveBeenCalledWith("");
    expect(input).toHaveValue("");
  });

  it("12. accepts plain digits, including leading zeros, and they accumulate correctly", async () => {
    const { input } = setup("");
    await userEvent.type(input, "007");
    expect(input).toHaveValue("007");
  });

  it("12. accepts a very large digit string (safety is enforced at validation, not at the keystroke level)", async () => {
    const { input } = setup("");
    await userEvent.type(input, "99999999999999999999");
    expect(input).toHaveValue("99999999999999999999");
  });

  it("12. rejects a fraction (.) — keystroke never applied", async () => {
    const { input } = setup("");
    await userEvent.type(input, "1.5");
    expect(input).toHaveValue("15");
  });

  it("12. rejects scientific notation ('e')", async () => {
    const { input } = setup("");
    await userEvent.type(input, "1e5");
    expect(input).toHaveValue("15");
  });

  it("12. rejects a leading '+'", async () => {
    const { input } = setup("");
    await userEvent.type(input, "+5");
    expect(input).toHaveValue("5");
  });

  it("12. rejects a leading '-'", async () => {
    const { input } = setup("");
    await userEvent.type(input, "-5");
    expect(input).toHaveValue("5");
  });

  it("12. rejects embedded whitespace (e.g. a pasted thousands-separated value)", async () => {
    const { input } = setup("");
    await userEvent.type(input, "1 000");
    expect(input).toHaveValue("1000");
  });

  it("uses a numeric input mode for the on-screen keyboard", () => {
    const { input } = setup("");
    expect(input).toHaveAttribute("inputMode", "numeric");
  });
});
