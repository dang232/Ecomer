import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("../components/footer", () => ({ Footer: () => <footer>Footer</footer> }));
vi.mock("../components/navbar", () => ({ Navbar: () => <header>Storefront header</header> }));
vi.mock("@/features/storefront", () => ({
  StorefrontMobileNav: () => <nav aria-label="Storefront navigation">Mobile nav</nav>,
}));

import { StorefrontLayout } from "./StorefrontLayout";

describe("StorefrontLayout", () => {
  it("owns the main landmark and reserves mobile-nav space for storefront content", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<StorefrontLayout />}>
            <Route index element={<p>Marketplace content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("banner")).toHaveTextContent("Storefront header");
    expect(screen.getByRole("main")).toHaveTextContent("Marketplace content");
    expect(screen.getByRole("main").className).toContain("safe-area-inset-bottom");
    expect(screen.getByRole("navigation", { name: "Storefront navigation" })).toBeVisible();
  });
});
