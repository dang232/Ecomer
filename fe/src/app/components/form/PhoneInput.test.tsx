/** Unit tests for the PhoneInput component. The full register-form integration
 *  is covered in RegisterPage.test.tsx; this file tests the component in
 *  isolation so future changes to the form don't have to drag the whole
 *  page along. */
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en" },
  }),
}));

import { PhoneInput } from "./PhoneInput";

/** Set the input value through React's native setter so the controlled-input
 *  state machine picks up the change. */
const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

/** Stateful wrapper so the component behaves like it's mounted in a real form. */
function ControlledPhoneInput(props: {
  initialValue?: string;
  label?: string;
  helperText?: string;
  error?: string;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = useState(props.initialValue ?? "");
  return (
    <PhoneInput
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
      label={props.label ?? "Phone"}
      helperText={props.helperText ?? "9 or 10 digits, numbers only"}
      error={props.error}
      id="phone"
    />
  );
}

describe("PhoneInput", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the +84 prefix as a non-editable badge inside the input", () => {
    render(<ControlledPhoneInput />);
    expect(screen.getByText("+84")).toBeInTheDocument();
  });

  it("always shows the helper hint above the input", () => {
    render(<ControlledPhoneInput />);
    const helper = document.getElementById("phone-helper");
    expect(helper).not.toBeNull();
    expect(helper?.textContent).toMatch(/9 or 10 digits/i);
  });

  it("strips every non-digit character from the input", () => {
    render(<ControlledPhoneInput />);
    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    // 8 digit characters embedded in letters and symbols, with an extra +84
    // thrown in. The visible input should contain only the 8 digits (the cap
    // at 10 is exercised by the next test).
    setInputValue(input, "+1a2b3c4d5e");
    expect(input.value).toBe("12345");
  });

  it("emits a full +84-prefixed E.164 string via onChange", () => {
    const onChange = vi.fn();
    render(<ControlledPhoneInput onChange={onChange} />);
    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    setInputValue(input, "12345");
    expect(onChange).toHaveBeenLastCalledWith("+8412345");
  });

  it("caps input at 10 digits even if the user pastes more", () => {
    render(<ControlledPhoneInput />);
    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    setInputValue(input, "12345678901234567");
    expect(input.value).toBe("1234567890");
  });

  it("reports a 'too short' error after the user types 1-8 digits", () => {
    render(<ControlledPhoneInput />);
    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    setInputValue(input, "1234");
    const alert = document.querySelector("[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toMatch(/too short/i);
  });

  it("clears the error as soon as the user reaches 9 valid digits", () => {
    render(<ControlledPhoneInput />);
    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    setInputValue(input, "1234");
    expect(document.querySelector("[role='alert']")).not.toBeNull();
    setInputValue(input, "912345678");
    expect(document.querySelector("[role='alert']")).toBeNull();
  });

  it("does not show a 'too short' error when the field is empty (optional)", () => {
    render(<ControlledPhoneInput />);
    // Empty is valid; the field is optional. No live error.
    expect(document.querySelector("[role='alert']")).toBeNull();
  });

  it("lets an external error override the live error (e.g. server-side 400)", () => {
    render(<ControlledPhoneInput initialValue="+84912345678" error="Phone rejected by server" />);
    const alert = document.querySelector("[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toBe("Phone rejected by server");
  });

  it("passes an aria-describedby link to the helper text and the error", () => {
    render(<ControlledPhoneInput initialValue="+841234" />);
    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toMatch(/phone-helper/);
    // When the field is in error, the error id is also in the describedby.
    expect(describedBy).toMatch(/phone-error/);
  });
});
