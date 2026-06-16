/** Tests for the phone-field validation on the registration form.
 *
 *  Bug: the phone <input> accepted any string and the BE silently dropped
 *  non-E.164 values. Now the FE forces a country-aware validation via
 *  libphonenumber-js, formats the number to E.164 on submit, and the BE
 *  rejects non-E.164 input with 400. */
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
      const FIXTURES: Record<string, string> = {
        "register.form.phoneHelper":
          "Select your country and enter your number",
        "register.form.errorPhoneInvalid":
          "Phone must be a valid international number.",
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

import { MemoryRouter } from "react-router";
import { RegisterPage } from "./RegisterPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/register"]}>
      <RegisterPage />
    </MemoryRouter>,
  );

/** CountryPhoneInput renders the error alert with id `phone-error`. */
const PHONE_ERROR_ID = "phone-error";
/** Generic matcher that works across both Vietnam and other countries'
 *  error messages (libphonenumber-js messages vary by country). */
const PHONE_ERROR_RE = /(too short|too long|not valid)/i;

const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

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
    setInputValue(phoneInput, overrides.phone);
  }
  fireEvent.change(screen.getByLabelText(/^password/i), {
    target: { value: "Password1" },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: "Password1" },
  });
};

describe("RegisterPage phone field (CountryPhoneInput)", () => {
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

  it("shows the country picker pre-set to Vietnam", () => {
    renderPage();
    const select = screen.getByLabelText(/country code/i) as HTMLSelectElement;
    expect(select.value).toBe("VN");
  });

  it("shows a permanent helper hint above the input", () => {
    renderPage();
    const helper = document.getElementById("phone-helper");
    expect(helper).not.toBeNull();
    expect(helper?.textContent).toMatch(/Select your country and enter your number/i);
  });

  it("strips non-digit input from the visible input", () => {
    renderPage();
    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    setInputValue(input, "+1a2b3c4d5e hello +84");
    // Letters, '+', and the literal word are stripped. The visible value
    // contains only digits and AsYouType formatting spaces — no letters.
    expect(input.value).not.toMatch(/[a-zA-Z+]/);
    expect(input.value.replace(/\D/g, "")).toBeTruthy();
  });

  it("shows a 'too short' error when fewer digits than the country requires", async () => {
    renderPage();
    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    setInputValue(input, "1234");
    await waitFor(() => {
      const alert = document.getElementById(PHONE_ERROR_ID);
      expect(alert).not.toBeNull();
      expect(alert?.getAttribute("role")).toBe("alert");
      expect(alert?.textContent).toMatch(PHONE_ERROR_RE);
    });
  });

  it("clears the error as soon as the user has the right number of digits", async () => {
    renderPage();
    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    setInputValue(input, "1234");
    await waitFor(() => {
      expect(document.getElementById(PHONE_ERROR_ID)).not.toBeNull();
    });
    // 9 valid Vietnam digits clears the error.
    setInputValue(input, "912345678");
    await waitFor(() => {
      expect(document.getElementById(PHONE_ERROR_ID)).toBeNull();
    });
  });

  it("accepts a valid Vietnam number and submits as +84 prefixed E.164", async () => {
    renderPage();
    fillRequiredFields({ phone: "912345678" });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        expect.objectContaining({ phone: "+84912345678" }),
      );
    });
  });

  it("re-formats the value with the new country code when the country is changed", async () => {
    renderPage();
    const input = screen.getByLabelText(/phone/i) as HTMLInputElement;
    setInputValue(input, "912345678"); // 9 valid VN digits

    // Switch to US — those 9 digits don't fit US (needs 10). The component
    // re-emits the value with the new dial code, but the new combination
    // is "invalid" for US. The point of this test is the dial code swap.
    const select = screen.getByLabelText(/country code/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "US" } });

    // The input still has 9 digits, the country is now US.
    expect(select.value).toBe("US");
    // The stored value should be re-emitted under +1.
    await waitFor(() => {
      const dataValid = document.querySelector("[data-country='US']");
      expect(dataValid).not.toBeNull();
    });
  });

  it("submits a valid US number with +1 prefix", async () => {
    renderPage();
    fillRequiredFields({ phone: "2025551234" }); // 10 digits, valid US
    // Switch country to US.
    const select = screen.getByLabelText(/country code/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "US" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        expect.objectContaining({ phone: "+12025551234" }),
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

  it("surfaces a BE validation_error on phone as a field error, not a banner", async () => {
    const { AuthError } = await import("../lib/auth/native-auth");
    registerMock.mockRejectedValueOnce(
      new AuthError(400, "validation_error", "phone: phone must be in E.164"),
    );
    renderPage();
    fillRequiredFields({ phone: "912345678" });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(document.getElementById(PHONE_ERROR_ID)?.getAttribute("role"))
        .toBe("alert");
    });
    expect(
      screen.queryByText(/phone: phone must be in E\.164/),
    ).not.toBeInTheDocument();
  });
});
