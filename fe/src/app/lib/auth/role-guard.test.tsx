import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();

vi.mock("../../hooks/use-auth", () => ({
  useAuth: () => useAuthMock(),
}));

import { RequireAuth, RequireRole } from "./role-guard";

function renderRoute(initialEntry: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/" element={<div data-testid="home-page">Home</div>} />
        <Route path="/access-denied" element={<div data-testid="access-denied-page">403</div>} />
        <Route path="/protected" element={element} />
        <Route path="/seller" element={element} />
        <Route path="/admin" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  it("renders nothing while keycloak is initialising", () => {
    useAuthMock.mockReturnValue({ ready: false, authenticated: false, roles: [] });
    const { container } = renderRoute(
      "/protected",
      <RequireAuth>
        <div data-testid="protected-content">Secret</div>
      </RequireAuth>,
    );
    expect(container.querySelector("[data-testid='protected-content']")).toBeNull();
    expect(container.querySelector("[data-testid='login-page']")).toBeNull();
  });

  it("redirects unauthenticated users to /login with a next param", () => {
    useAuthMock.mockReturnValue({ ready: true, authenticated: false, roles: [] });
    renderRoute(
      "/protected",
      <RequireAuth>
        <div data-testid="protected-content">Secret</div>
      </RequireAuth>,
    );
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("renders the children when authenticated", () => {
    useAuthMock.mockReturnValue({ ready: true, authenticated: true, roles: ["BUYER"] });
    renderRoute(
      "/protected",
      <RequireAuth>
        <div data-testid="protected-content">Secret</div>
      </RequireAuth>,
    );
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });
});

describe("RequireRole", () => {
  it("redirects to /login when not authenticated", () => {
    useAuthMock.mockReturnValue({ ready: true, authenticated: false, roles: [] });
    renderRoute(
      "/seller",
      <RequireRole role="SELLER">
        <div data-testid="seller-content">Seller</div>
      </RequireRole>,
    );
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("seller-content")).toBeNull();
  });

  it("redirects to fallback when authenticated without the required role", () => {
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: true,
      roles: ["BUYER"],
    });
    renderRoute(
      "/seller",
      <RequireRole role="SELLER">
        <div data-testid="seller-content">Seller</div>
      </RequireRole>,
    );
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
    expect(screen.queryByTestId("seller-content")).toBeNull();
  });

  it("renders the children when the user has the role", () => {
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: true,
      roles: ["BUYER", "SELLER"],
    });
    renderRoute(
      "/seller",
      <RequireRole role="SELLER">
        <div data-testid="seller-content">Seller</div>
      </RequireRole>,
    );
    expect(screen.getByTestId("seller-content")).toBeInTheDocument();
  });

  it("ADMIN role gates ADMIN-only routes", () => {
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: true,
      roles: ["BUYER", "SELLER"],
    });
    renderRoute(
      "/admin",
      <RequireRole role="ADMIN">
        <div data-testid="admin-content">Admin</div>
      </RequireRole>,
    );
    expect(screen.getByTestId("home-page")).toBeInTheDocument();

    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: true,
      roles: ["ADMIN"],
    });
    renderRoute(
      "/admin",
      <RequireRole role="ADMIN">
        <div data-testid="admin-content">Admin</div>
      </RequireRole>,
    );
    expect(screen.getByTestId("admin-content")).toBeInTheDocument();
  });

  it("redirects a signed-in buyer from an admin route to the 403 page", () => {
    useAuthMock.mockReturnValue({
      ready: true,
      authenticated: true,
      roles: ["BUYER"],
    });

    renderRoute(
      "/admin",
      <RequireRole role="ADMIN" fallbackPath="/access-denied">
        <div data-testid="admin-content">Admin</div>
      </RequireRole>,
    );

    expect(screen.getByTestId("access-denied-page")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-content")).toBeNull();
  });
});
