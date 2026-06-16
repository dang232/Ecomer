/** Tests for the phone-field validation on the registration form.
 *
 *  Bug: the phone <input> accepted any string and the BE silently dropped
 *  non-E.164 values. Now the FE blocks submit, forces digits-only input,
 *  shows a live inline error, and the BE rejects non-E.164 input with 400. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const registerMock = vi.fn();

vi.mock("../hooks/use-auth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../lib/api/endpoints/users", () => ({
  myProfile: vi.fn(),
  setDefaultAddress: vi.fn(),
  removeAddress: vi.fn(),
  addAddress: vi.fn(),
  updateProfile: vi.fn(),
  avatarUpload: vi.fn(),
  avatarActivate: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (typeof opts?.defaultValue === "string") return opts.defaultValue;
      // Inline copy for the keys the tests assert on, so we don't have to
      // mock the i18n bundle import path.
      const FIXTURES: Record<string, string> = {
        "register.form.phoneHelper": "9 or 10 digits, numbers only",
        "register.form.errorPhoneInvalid":
          "Phone must be a Vietnamese number in +84 format, e.g. +84912345678.",
        "register.form.errorEmailInvalid": "Enter a valid email address.",
        "register.form.errorPasswordShort": "Password must be at least 8 characters.",
        "register.form.errorMismatch": "Passwords don't match.",
        "register.form.errorFirstNameRequired": "First name is required",
        "register.form.errorLastNameRequired": "Last name is required",
        "register.form.errorEmailTaken": "An account with that email already exists.",
        "register.form.errorWeakPassword": "Password is too weak. Use at least 8 characters.",
        "register.form.errorGeneric": "Couldn't create account. Try again in a moment.",
      };
      return FIXTURES[key] ?? key;
    },
    i18n: { resolvedLanguage: "en" },
  }),
}));

import { RegisterPage } from "./RegisterPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/register"]}>
      <RegisterPage />
    </MemoryRouter>,
  );

// MemoryRouter is a real import — it has to come after the vi.mock calls
// so the page's module-level imports pick up the mocks.
import { MemoryRouter } from "react-router";

/** The PhoneInput component renders the error alert with `id="{id}-error"`. */
const PHONE_ERROR_ID = "phone-error";
/** The "+84" prefix is a non-editable visual badge inside the input. */
const PHONE_PREFIX_TEXT = "+84";
/** Canonical text used to assert on the field-level error. */
const PHONE_ERROR_RE = /\+84 format/i;

const fillRequiredFields = (overrides: { phone?: string } = {}) => {
  fireEvent.change(screen.getByLabelText(/first name/i), {
    target: { value: "Alice" },
  });
  fireEvent.change(screen.getByLabelText(/last name/i), {
    target: { value: "Nguyen" },
  });
  fireEvent.change(screen.getByLabelText(/^email/i), {
    target: { value: "alice@example.com" },
  });
  if (overrides.phone !== undefined) {
    const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement;
    // Use the native setter so React's controlled input picks up the change.
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeSetter?.call(phoneInput, overrides.phone);
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  fireEvent.change(screen.getByLabelText(/^password/i), {
    target: { value: "Password1" },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: "Password1" },
  });
};

describe("RegisterPage phone field", () => {
  beforeEach(() => {
    registerMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: false,
      register: registerMock,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the +84 prefix as a non-editable badge inside the input", () => {
    renderPage();
    expect(screen.getByText(PHONE_PREFIX_TEXT)).toBeInTheDocument();
    // The prefix should be inside the same flex row as the input — visual
    // adjacency, not a separate element outside the field.
    const phoneInput = screen.getByLabelText(/phone/i);
    const wrapper = phoneInput.parentElement;
    expect(wrapper?.textContent).toContain(PHONE_PREFIX_TEXT);
  });

  it("shows a permanent helper hint above the input", () => {
    renderPage();
    const helper = document.getElementById("phone-helper");
    expect(helper).not.toBeNull();
    expect(helper?.textContent).toMatch(/9 or 10 digits/i);
  });

  it("strips non-digit input — the user can never type letters or +", () => {
    renderPage();
    const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement;
    // Simulate a paste that contains letters, spaces, and an extra + sign.
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeSetter?.call(phoneInput, "+1a2b3c4d5e6f7g");
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
    // The displayed value is digits only, capped at 10 characters.
    expect(phoneInput.value).toBe("1234567");
  });

  it("shows a live 'too short' error while the user types fewer than 9 digits", async () => {
    renderPage();
    const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeSetter?.call(phoneInput, "1234");
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));

    await waitFor(() => {
      const alert = document.getElementById(PHONE_ERROR_ID);
      expect(alert).not.toBeNull();
      expect(alert?.getAttribute("role")).toBe("alert");
      expect(alert?.textContent).toMatch(/too short/i);
    });
  });

  it("clears the error as soon as the user types 9 valid digits", async () => {
    renderPage();
    const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;

    // Type 4 digits → error appears
    nativeSetter?.call(phoneInput, "1234");
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
    await waitFor(() => {
      expect(
        document.getElementById(PHONE_ERROR_ID)?.textContent,
      ).toMatch(/too short/i);
    });

    // Type 9 digits → error clears
    nativeSetter?.call(phoneInput, "912345678");
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
    await waitFor(() => {
      expect(document.getElementById(PHONE_ERROR_ID)).toBeNull();
    });
  });

  it("accepts a valid 9-digit local number and submits the registration as +84 prefixed E.164", async () => {
    renderPage();
    fillRequiredFields({ phone: "912345678" });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        expect.objectContaining({ phone: "+84912345678" }),
      );
    });
  });

  it("accepts a valid 10-digit local number", async () => {
    renderPage();
    fillRequiredFields({ phone: "9123456789" });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        expect.objectContaining({ phone: "+849123456789" }),
      );
    });
  });

  it("treats an empty phone as valid and submits without the field", async () => {
    renderPage();
    fillRequiredFields(); // no phone

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        expect.objectContaining({ phone: undefined }),
      );
    });
  });

  it("rejects submission when the user has typed too few digits", async () => {
    renderPage();
    fillRequiredFields({ phone: "1234" });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      const alert = document.getElementById(PHONE_ERROR_ID);
      expect(alert).not.toBeNull();
      expect(alert?.getAttribute("role")).toBe("alert");
    });
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("surfaces a BE validation_error on phone as a field error, not a banner", async () => {
    // Mimic the BE's validation handler shape: { errorCode, message }.
    const { AuthError } = await import("../lib/auth/native-auth");
    registerMock.mockRejectedValueOnce(
      new AuthError(400, "validation_error", "phone: phone must be in E.164"),
    );
    renderPage();
    fillRequiredFields({ phone: "912345678" });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    // FormField renders the error in a <p id="phone-error" role="alert">.
    await waitFor(() => {
      expect(document.getElementById(PHONE_ERROR_ID)?.getAttribute("role"))
        .toBe("alert");
    });
    // Should NOT have rendered a server-error banner with the raw BE message.
    expect(
      screen.queryByText(/phone: phone must be in E\.164/),
    ).not.toBeInTheDocument();
  });
});
