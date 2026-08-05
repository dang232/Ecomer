/** Tests for the phone-field validation on the registration form.
 *
 *  Bug: the phone <input> accepted any string and the BE silently dropped
 *  non-E.164 values. Now the FE forces a country-aware validation via
 *  libphonenumber-js, formats the number to E.164 on submit, and the BE
 *  rejects non-E.164 input with 400. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn<() => unknown>();
const registerMock = vi.fn();
const loginWithPasswordMock = vi.fn();

vi.mock("../hooks/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/shared/api/endpoints/users", () => ({
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
      const FIXTURES: Record<string, string> = {
        "login.termsNotice":
          "By signing in you agree to VNShop's Terms of Service and Privacy Policy.",
        "register.termsNotice":
          "By creating an account you agree to VNShop's Terms of Service and Privacy Policy.",
        "register.form.phoneHelper": "Select your country and enter your number",
        "register.form.errorPhoneInvalid": "Phone must be a valid international number.",
        "register.form.errorEmailInvalid": "Enter a valid email address.",
        "register.form.errorPasswordShort": "Password must be at least 8 characters.",
        "register.form.errorMismatch": "Passwords don't match.",
        "register.form.errorFirstNameRequired": "First name is required",
        "register.form.errorLastNameRequired": "Last name is required",
        "register.form.errorEmailTaken": "An account with that email already exists.",
        "register.form.errorPhoneTaken": "An account with that phone number already exists.",
        "register.form.errorWeakPassword": "Password is too weak. Use at least 8 characters.",
        "register.form.errorGeneric": "Couldn't create account. Try again in a moment.",
      };
      if (key in FIXTURES) return FIXTURES[key];
      if (typeof opts?.defaultValue === "string") return opts.defaultValue;
      return key;
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
  const setter = Reflect.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (setter) Reflect.apply(setter, input, [value]);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

/**
 * Open the country dropdown and click the option whose visible label
 * contains the given substring (e.g. "United States" or "VN"). Then close
 * the popover by pressing Escape.
 */
const pickCountry = async (matcher: RegExp) => {
  // The CountryDropdown's trigger has aria-haspopup="listbox".
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
  if (!trigger) throw new Error("country trigger not found");
  fireEvent.click(trigger);
  // Wait for the dialog to appear.
  await waitFor(() => {
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
  const options = document.querySelectorAll<HTMLElement>('[role="option"]');
  const target = Array.from(options).find((o) => matcher.test(o.textContent ?? ""));
  if (!target) throw new Error(`no country option matches ${matcher}`);
  fireEvent.click(target);
  // Press Escape to close.
  fireEvent.keyDown(document, { key: "Escape" });
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
    const phoneInput = screen.getByLabelText<HTMLInputElement>(/phone/i);
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
    loginWithPasswordMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: false,
      register: registerMock,
      loginWithPassword: loginWithPasswordMock,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the country picker pre-set to Vietnam (with a flag and dial code)", () => {
    renderPage();
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
    expect(trigger).not.toBeNull();
    // The trigger should show the Vietnam flag, the +84 dial code, and be
    // labelled with "Country code" for screen readers.
    expect(trigger?.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger?.getAttribute("aria-label")).toBe("Country code");
    expect(trigger?.textContent).toMatch(/\+84/);
    // The Vietnam flag emoji is two regional-indicator code points.
    expect(trigger?.textContent).toMatch(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  });

  it("shows a permanent helper hint above the input", () => {
    renderPage();
    const helper = document.getElementById("phone-helper");
    expect(helper).not.toBeNull();
    expect(helper?.textContent).toMatch(/Select your country and enter your number/i);
  });

  it("uses sign-up terms copy instead of the login notice", () => {
    renderPage();

    expect(
      screen.getByText(
        "By creating an account you agree to VNShop's Terms of Service and Privacy Policy.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "By signing in you agree to VNShop's Terms of Service and Privacy Policy.",
      ),
    ).not.toBeInTheDocument();
  });

  it("strips non-digit input from the visible input", () => {
    renderPage();
    const input = screen.getByLabelText<HTMLInputElement>(/phone/i);
    setInputValue(input, "+1a2b3c4d5e hello +84");
    // Letters, '+', and the literal word are stripped. The visible value
    // contains only digits and AsYouType formatting spaces — no letters.
    expect(input.value).not.toMatch(/[a-zA-Z+]/);
    expect(input.value.replace(/\D/g, "")).toBeTruthy();
  });

  it("shows a 'too short' error when fewer digits than the country requires", async () => {
    renderPage();
    const input = screen.getByLabelText<HTMLInputElement>(/phone/i);
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
    const input = screen.getByLabelText<HTMLInputElement>(/phone/i);
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
      expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ phone: "+84912345678" }));
    });
  });

  it("opens the country dropdown and re-formats the value with the new country", async () => {
    renderPage();
    const input = screen.getByLabelText<HTMLInputElement>(/phone/i);
    setInputValue(input, "912345678"); // 9 valid VN digits

    // Switch to US via the dropdown.
    await pickCountry(/United States/);
    await waitFor(() => {
      const dataCountry = document.querySelector("[data-country='US']");
      expect(dataCountry).not.toBeNull();
    });
    // The input should now show the US-formatted version of the digits
    // (parens + dash per AsYouType).
    expect(input.value).toMatch(/[()]/);
  });

  it("submits a valid US number with +1 prefix", async () => {
    renderPage();
    fillRequiredFields({ phone: "2025551234" }); // 10 digits, valid US
    await pickCountry(/United States/);
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ phone: "+12025551234" }));
    });
  });

  it("treats an empty phone as valid and submits without the field", async () => {
    renderPage();
    fillRequiredFields(); // no phone
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ phone: undefined }));
    });
  });

  it("surfaces a BE validation_error on phone as a field error, not a banner", async () => {
    const { AuthError } = await import("@/shared/auth");
    registerMock.mockRejectedValueOnce(
      new AuthError(400, "validation_error", "phone: phone must be in E.164"),
    );
    renderPage();
    fillRequiredFields({ phone: "912345678" });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(document.getElementById(PHONE_ERROR_ID)?.getAttribute("role")).toBe("alert");
    });
    expect(screen.queryByText(/phone: phone must be in E\.164/)).not.toBeInTheDocument();
  });

  it("surfaces a duplicate phone as a phone field error", async () => {
    const { AuthError } = await import("@/shared/auth");
    registerMock.mockRejectedValueOnce(new AuthError(409, "phone_taken", "Phone already used"));
    renderPage();
    fillRequiredFields({ phone: "912345678" });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(document.getElementById(PHONE_ERROR_ID)?.getAttribute("role")).toBe("alert");
    });
    expect(
      screen.getByText("An account with that phone number already exists."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Phone already used")).not.toBeInTheDocument();
  });

  it("surfaces a duplicate email as an email field error", async () => {
    const { AuthError } = await import("@/shared/auth");
    registerMock.mockRejectedValueOnce(new AuthError(409, "email_taken", "Email already used"));
    renderPage();
    fillRequiredFields({ phone: "912345678" });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("An account with that email already exists.")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Email already used")).not.toBeInTheDocument();
  });
});
