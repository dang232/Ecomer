import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn<() => unknown>();

vi.mock("../hooks/auth-context", () => ({ useAuth: () => useAuthMock() }));
vi.mock("../hooks/use-app-config", () => ({
  useAppConfig: () => ({ auth: { oauthProviders: ["google"] } }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) =>
      typeof options?.defaultValue === "string" ? options.defaultValue : _key,
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
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: false,
      roles: [],
      loginWithPassword,
      beginOAuthLogin,
    });
  });

  it("submits credentials through the native auth boundary", async () => {
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
    expect(screen.getByRole("button", { name: "facebook" })).toBeDisabled();
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
