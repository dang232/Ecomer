import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/shared/auth";

const useAuthMock = vi.fn<() => unknown>();
const i18nMock = vi.hoisted(
  (): {
    language: "en" | "vi";
    translations: Record<"en" | "vi", Record<string, string>>;
  } => ({
    language: "en",
    translations: {
      en: {
        "login.form.errorInvalidCredentials":
          "Invalid user credentials. Check your email/username and password.",
        "login.form.errorGeneric": "Couldn't sign in. Try again in a moment.",
      },
      vi: {
        "login.form.errorInvalidCredentials":
          "Thông tin đăng nhập không hợp lệ. Vui lòng kiểm tra email/tên đăng nhập và mật khẩu.",
        "login.form.errorGeneric": "Không thể đăng nhập. Vui lòng thử lại.",
      },
    },
  }),
);

vi.mock("../hooks/auth-context", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../hooks/use-app-config", () => ({
  useAppConfig: () => ({ auth: { oauthProviders: ["google"] } }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      i18nMock.translations[i18nMock.language][key] ??
      (typeof options?.defaultValue === "string" ? options.defaultValue : key),
  }),
}));

import { LoginPage } from "./LoginPage";

function renderLogin(initialEntry = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<div data-testid="admin-console" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage native auth", () => {
  const loginWithPassword = vi.fn();
  const beginOAuthLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    i18nMock.language = "en";
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: false,
      roles: [],
      loginWithPassword,
      beginOAuthLogin,
    });
  });

  it.each([
    ["English", "en", "Invalid user credentials. Check your email/username and password."],
    [
      "Vietnamese",
      "vi",
      "Thông tin đăng nhập không hợp lệ. Vui lòng kiểm tra email/tên đăng nhập và mật khẩu.",
    ],
  ] as const)(
    "renders the localized invalid-credentials message in %s",
    async (_languageName, language, localizedMessage) => {
      i18nMock.language = language;
      loginWithPassword.mockRejectedValueOnce(
        new AuthError(401, "invalid_credentials", "Auth failed (HTTP 401)"),
      );
      renderLogin();

      fireEvent.change(screen.getByLabelText(/email or username/i), {
        target: { value: "buyer1" },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "wrong" } });
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(localizedMessage);
      expect(alert).not.toHaveTextContent("Auth failed (HTTP 401)");
    },
  );

  it("keeps other login failures behind the localized generic message", async () => {
    loginWithPassword.mockRejectedValueOnce(new Error("backend detail"));
    renderLogin();

    fireEvent.change(screen.getByLabelText(/email or username/i), {
      target: { value: "buyer1" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't sign in. Try again in a moment.");
    expect(alert).not.toHaveTextContent("backend detail");
  });

  it("submits credentials through the native auth boundary", () => {
    renderLogin("/login?next=%2Forders%3Fstatus%3DSHIPPED");

    fireEvent.change(screen.getByLabelText(/email or username/i), {
      target: { value: "buyer1" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(loginWithPassword).toHaveBeenCalledWith("buyer1", "test");
  });

  it("keeps a malicious return destination out of the auth request", () => {
    renderLogin("/login?next=https%3A%2F%2Fattacker.invalid");

    fireEvent.change(screen.getByLabelText(/email or username/i), {
      target: { value: "buyer1" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(loginWithPassword).toHaveBeenCalledWith("buyer1", "test");
  });

  it("uses the gateway OAuth boundary only for enabled providers", () => {
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: "google" }));

    expect(beginOAuthLogin).toHaveBeenCalledWith("google", "/");
    expect(screen.getByLabelText("facebook sign-in unavailable")).toHaveTextContent("Unavailable");
  });

  it("redirects an authenticated admin using the existing role contract", () => {
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: true,
      roles: ["ADMIN"],
      loginWithPassword,
      beginOAuthLogin,
    });

    renderLogin();

    expect(screen.getByTestId("admin-console")).toBeInTheDocument();
  });
});
