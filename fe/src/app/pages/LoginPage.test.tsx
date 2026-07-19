import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();

vi.mock("../hooks/use-auth", () => ({ useAuth: () => useAuthMock() }));
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

describe("LoginPage OIDC routing", () => {
  const login = vi.fn();
  const beginOAuthLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: false,
      roles: [],
      login,
      beginOAuthLogin,
    });
  });

  it("starts OIDC with the sanitized requested destination", () => {
    renderLogin("/login?next=%2Forders%3Fstatus%3DSHIPPED");

    fireEvent.click(screen.getByRole("button", { name: /continue to sign in/i }));

    expect(login).toHaveBeenCalledWith("/orders?status=SHIPPED");
  });

  it("fails a malicious return destination closed to the storefront", () => {
    renderLogin("/login?next=https%3A%2F%2Fattacker.invalid");

    fireEvent.click(screen.getByRole("button", { name: /continue to sign in/i }));

    expect(login).toHaveBeenCalledWith("/");
  });

  it("uses Keycloak identity-provider hints only for enabled providers", () => {
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
      login,
      beginOAuthLogin,
    });

    renderLogin();

    expect(screen.getByTestId("admin-console")).toBeInTheDocument();
  });
});
