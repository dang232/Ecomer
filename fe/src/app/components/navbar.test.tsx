import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Navbar } from "./navbar";

type VNShopMockState = {
  user: { name: string; avatar: string } | null;
  isDark: boolean;
  isLoggedIn: boolean;
  logout: () => void;
  toggleTheme: () => void;
};

const useVNShopMock = vi.fn<() => VNShopMockState>();

vi.mock("../hooks/use-vnshop", () => ({
  useVNShop: () => useVNShopMock(),
}));

vi.mock("../hooks/use-cart", () => ({
  useCart: () => ({ itemCount: 0 }),
}));

vi.mock("../hooks/use-wishlist", () => ({
  useWishlist: () => ({ ids: [] }),
}));

vi.mock("../hooks/use-search-suggestions", () => ({
  useSearchSuggestions: () => ({ suggestions: [] }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          "nav.switchToDarkMode": "Switch to dark mode",
          "nav.switchToLightMode": "Switch to light mode",
          "nav.darkMode": "Dark mode",
          "nav.lightMode": "Light mode",
          "nav.announcement": "Free shipping on orders over 150k!",
          "nav.announcementSuffix": "Shop now",
          "search.placeholder": "Search products",
          "search.mobilePlaceholder": "Search",
          "cart.title": "Cart",
          "auth.wishlist": "Wishlist",
          "auth.login": "Log in",
          "auth.myAccount": "My Account",
          "auth.myOrders": "My Orders",
          "auth.logout": "Log out",
          "storefront.accountMenu": "Account menu",
          "storefront.categories.navigation": "Product categories",
          "home.tabs.all": "All",
          "categories.electronics": "Electronics",
          "categories.fashion": "Fashion",
          "categories.home": "Home & Living",
          "categories.software": "Software",
          "categories.beauty": "Beauty",
          "categories.sports": "Sports",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock("@/shared/ui", () => ({
  ImageWithFallback: () => <div />,
  LiveRegion: () => null,
}));

vi.mock("./language-switcher", () => ({
  LanguageSwitcher: () => <div>lang</div>,
}));

vi.mock("./notification-bell", () => ({
  NotificationBell: () => <div>notifications</div>,
}));

vi.mock("./search-autocomplete", () => ({
  SearchAutocomplete: ({ placeholder }: { placeholder: string }) => (
    <input aria-label={placeholder} />
  ),
}));

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );
}

describe("Navbar", () => {
  beforeEach(() => {
    useVNShopMock.mockReturnValue({
      user: null,
      isDark: false,
      isLoggedIn: false,
      logout: vi.fn(),
      toggleTheme: vi.fn(),
    });
  });

  it("announces the next theme action in the toggle label and title", () => {
    const { rerender } = renderNavbar();

    const darkToggles = screen.getAllByRole("button", { name: "Switch to dark mode" });
    expect(darkToggles).toHaveLength(2);
    expect(darkToggles.some((button) => button.className.includes("lg:inline-flex"))).toBe(true);
    expect(darkToggles.some((button) => button.className.includes("lg:hidden"))).toBe(true);
    for (const toggle of darkToggles) {
      expect(toggle).toHaveAttribute("title", "Switch to dark mode");
    }

    useVNShopMock.mockReturnValue({
      user: null,
      isDark: true,
      isLoggedIn: false,
      logout: vi.fn(),
      toggleTheme: vi.fn(),
    });

    rerender(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    const lightToggles = screen.getAllByRole("button", { name: "Switch to light mode" });
    expect(lightToggles).toHaveLength(2);
    expect(lightToggles.some((button) => button.className.includes("lg:inline-flex"))).toBe(true);
    expect(lightToggles.some((button) => button.className.includes("lg:hidden"))).toBe(true);
    for (const toggle of lightToggles) {
      expect(toggle).toHaveAttribute("title", "Switch to light mode");
    }
  });

  it("uses action-style labels in the account overflow theme control", () => {
    useVNShopMock.mockReturnValue({
      user: { name: "Alice", avatar: "" },
      isDark: false,
      isLoggedIn: true,
      logout: vi.fn(),
      toggleTheme: vi.fn(),
    });

    const { rerender } = renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.getByRole("menuitem", { name: "Switch to dark mode" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Dark mode" })).not.toBeInTheDocument();

    useVNShopMock.mockReturnValue({
      user: { name: "Alice", avatar: "" },
      isDark: true,
      isLoggedIn: true,
      logout: vi.fn(),
      toggleTheme: vi.fn(),
    });

    rerender(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("menuitem", { name: "Switch to light mode" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Light mode" })).not.toBeInTheDocument();
  });
});
