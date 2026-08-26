import { Heart, Moon, ShoppingBag, Sun, User, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";

import { ImageWithFallback, LiveRegion } from "@/shared/ui";

import { useCart } from "../hooks/use-cart";
import { useSearchSuggestions } from "../hooks/use-search-suggestions";
import { useVNShop } from "../hooks/use-vnshop";
import { useWishlist } from "../hooks/use-wishlist";

import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";
import { SearchAutocomplete } from "./search-autocomplete";

interface CategoryLink {
  id: string;
  labelKey: string;
  defaultLabel: string;
}

const categoryLinks: readonly CategoryLink[] = [
  { id: "all", labelKey: "home.tabs.all", defaultLabel: "All" },
  { id: "electronics", labelKey: "categories.electronics", defaultLabel: "Electronics" },
  { id: "fashion", labelKey: "categories.fashion", defaultLabel: "Fashion" },
  { id: "home", labelKey: "categories.home", defaultLabel: "Home & Living" },
  { id: "software", labelKey: "categories.software", defaultLabel: "Software" },
  { id: "beauty", labelKey: "categories.beauty", defaultLabel: "Beauty" },
  { id: "sports", labelKey: "categories.sports", defaultLabel: "Sports" },
];

function ActionLink({
  to,
  label,
  icon: Icon,
  count,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="relative inline-flex min-h-[var(--target-web)] min-w-[var(--target-web)] items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {count && count > 0 ? (
        <span className="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

export function AnnouncementBar() {
  const { t } = useTranslation();
  return (
    <div className="bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground">
      {t("nav.announcement")} {t("nav.announcementSuffix")}
    </div>
  );
}

export function CategoriesBar() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <nav
      aria-label={t("storefront.categories.navigation")}
      className="hidden border-t border-border bg-card md:block"
    >
      <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
        {categoryLinks.map((category) => {
          const href = category.id === "all" ? "/" : `/search?cat=${category.id}`;
          const active =
            (category.id === "all" && location.pathname === "/") ||
            new URLSearchParams(location.search).get("cat") === category.id;
          return (
            <Link
              key={category.id}
              to={href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-[var(--radius-round)] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {t(category.labelKey, { defaultValue: category.defaultLabel })}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Navbar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isDark, isLoggedIn, logout, toggleTheme } = useVNShop();
  const { itemCount: cartCount } = useCart();
  const { ids: wishlist } = useWishlist();
  const [searchQ, setSearchQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [cartAnnouncement, setCartAnnouncement] = useState("");
  const cartCountRef = useRef(cartCount);
  const { suggestions } = useSearchSuggestions(searchQ);

  useEffect(() => {
    if (cartCountRef.current !== cartCount) {
      setCartAnnouncement(t("cart.itemCount", { count: cartCount }));
      cartCountRef.current = cartCount;
    }
  }, [cartCount, t]);

  const submitSearch = (query: string) => {
    const normalized = query.trim();
    void navigate(normalized ? `/search?q=${encodeURIComponent(normalized)}` : "/search");
  };
  const themeActionLabel = isDark ? t("nav.switchToLightMode") : t("nav.switchToDarkMode");

  useEffect(() => {
    if (!menuOpen) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    const closeOnOutside = (event: MouseEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !menuTriggerRef.current?.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const current = items.indexOf(event.target as HTMLElement);
    if (current < 0) return;
    let target = current;
    if (event.key === "ArrowDown") target = (current + 1) % items.length;
    else if (event.key === "ArrowUp") target = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = items.length - 1;
    else return;
    event.preventDefault();
    items[target]?.focus();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <LiveRegion message={cartAnnouncement} />
      <AnnouncementBar />
      <div className="mx-auto grid h-14 max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 md:h-16 md:gap-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="text-xl font-extrabold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="VNShop home"
        >
          VNShop
        </Link>

        <div className="hidden min-w-0 md:block">
          <SearchAutocomplete
            value={searchQ}
            onValueChange={setSearchQ}
            suggestions={suggestions}
            onSubmit={submitSearch}
            placeholder={t("search.placeholder")}
          />
        </div>

        <div className="flex items-center justify-end gap-1">
          <div className="hidden lg:block">
            <LanguageSwitcher />
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeActionLabel}
            aria-pressed={isDark}
            title={themeActionLabel}
            className="hidden min-h-[var(--target-web)] min-w-[var(--target-web)] items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
          >
            {isDark ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeActionLabel}
            aria-pressed={isDark}
            title={themeActionLabel}
            className="inline-flex min-h-[var(--target-web)] min-w-[var(--target-web)] items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            {isDark ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <div className="hidden md:block">
            <NotificationBell />
          </div>
          <div className="hidden sm:block">
            <ActionLink
              to="/wishlist"
              label={t("auth.wishlist")}
              icon={Heart}
              count={wishlist.length}
            />
          </div>
          <ActionLink to="/cart" label={t("cart.title")} icon={ShoppingBag} count={cartCount} />
          <div className="relative hidden md:block">
            {isLoggedIn ? (
              <button
                type="button"
                ref={menuTriggerRef}
                data-account-menu-trigger
                aria-label={t("storefront.accountMenu")}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-controls={menuOpen ? menuId : undefined}
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex min-h-[var(--target-web)] items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ImageWithFallback
                  src={user?.avatar ?? ""}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                  imagePreset="avatar"
                  sizes="28px"
                />
                <span className="hidden lg:inline">{user?.name ?? t("auth.myAccount")}</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex min-h-[var(--target-web)] items-center gap-2 rounded-[var(--radius-control)] bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                {t("auth.login")}
              </Link>
            )}
            {menuOpen && isLoggedIn ? (
              <div
                id={menuId}
                ref={menuRef}
                role="menu"
                tabIndex={-1}
                onKeyDown={handleMenuKeyDown}
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid min-w-52 border border-border bg-card p-1 shadow-[var(--shadow-lg)]"
              >
                <Link
                  to="/profile"
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 text-sm hover:bg-muted"
                >
                  {t("auth.myAccount")}
                </Link>
                <Link
                  to="/orders"
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 text-sm hover:bg-muted"
                >
                  {t("auth.myOrders")}
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={0}
                  onClick={toggleTheme}
                  className="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {isDark ? (
                    <Sun className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Moon className="h-4 w-4" aria-hidden="true" />
                  )}
                  {themeActionLabel}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => {
                    logout("/");
                    setMenuOpen(false);
                  }}
                  className="px-3 py-2 text-left text-sm text-error hover:bg-error-light"
                >
                  {t("auth.logout")}
                </button>
              </div>
            ) : null}
          </div>
          <Link
            to={isLoggedIn ? "/profile" : "/login"}
            aria-label={t("auth.myAccount")}
            className="inline-flex min-h-[var(--target-web)] min-w-[var(--target-web)] items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted md:hidden"
          >
            <User className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="border-t border-border px-4 py-2 md:hidden">
        <SearchAutocomplete
          value={searchQ}
          onValueChange={setSearchQ}
          suggestions={suggestions}
          onSubmit={submitSearch}
          placeholder={t("search.mobilePlaceholder")}
        />
      </div>
      <CategoriesBar />
    </header>
  );
}
