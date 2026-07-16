import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();

vi.mock("../hooks/use-auth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("../hooks/use-app-config", () => ({
  useAppConfig: () => ({ auth: { oauthProviders: [] } }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      typeof options?.defaultValue === "string" ? options.defaultValue : key,
  }),
}));

import { LoginPage } from "./LoginPage";

function renderLogin(initialEntry = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div data-testid="storefront">Storefront</div>} />
        <Route path="/admin" element={<div data-testid="admin-console">Admin</div>} />
        <Route path="/orders" element={<div data-testid="orders">Orders</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage post-login routing", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: false,
      roles: [],
      loginWithCredentials: vi.fn().mockResolvedValue(["BUYER"]),
      beginOAuthLogin: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes an admin to /admin after credentials login with no next URL", async () => {
    const loginWithCredentials = vi.fn().mockResolvedValue(["ADMIN"]);
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: false,
      roles: [],
      loginWithCredentials,
      beginOAuthLogin: vi.fn(),
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/email or username/i), {
      target: { value: "admin1" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByTestId("admin-console")).toBeInTheDocument());
    expect(loginWithCredentials).toHaveBeenCalledWith("admin1", "test");
  });

  it("routes a buyer to the storefront after credentials login with no next URL", async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email or username/i), {
      target: { value: "buyer1" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByTestId("storefront")).toBeInTheDocument());
  });

  it("preserves an explicit safe next URL for an admin", async () => {
    const loginWithCredentials = vi.fn().mockResolvedValue(["ADMIN"]);
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: false,
      roles: [],
      loginWithCredentials,
      beginOAuthLogin: vi.fn(),
    });

    renderLogin("/login?next=%2Forders%3Fstatus%3DSHIPPED");
    fireEvent.change(screen.getByLabelText(/email or username/i), {
      target: { value: "admin1" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByTestId("orders")).toBeInTheDocument());
  });
});
