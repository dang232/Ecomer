import {
  ShoppingBag,
  Heart,
  Bell,
  User,
  Menu,
  X,
  Home,
  Package,
  LogOut,
  Settings,
  Store,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { useCart } from "../hooks/use-cart";
import { useSearchSuggestions } from "../hooks/use-search-suggestions";
import { useWishlist } from "../hooks/use-wishlist";
import { comingSoon } from "../lib/ui/coming-soon";

import { ImageWithFallback } from "./image-with-fallback";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";
import { SearchAutocomplete } from "./search-autocomplete";
import { LiveRegion } from "./ui/live-region";
import { useVNShop } from "./vnshop-context";

// ─── Announcement Bar ──────────────────────────────────────────────────────────
export function AnnouncementBar() {
  const { t } = useTranslation();
  return (
    <div className="bg-primary text-white text-center py-2.5 px-4 text-xs font-medium tracking-tight animate-fade-in">
      <Sparkles className="inline w-3.5 h-3.5 -mt-0.5 mr-1.5" />
      {t("nav.announcement", { defaultValue: "New users get" })}{" "}
      <span className="text-primary-light font-semibold">₫50,000 OFF</span>{" "}
      {t("nav.announcementSuffix", { defaultValue: "first order — Code:" })}{" "}
      <strong>VNWELCOME</strong>
    </div>
  );
}

// ─── Categories Bar ────────────────────────────────────────────────────────────
const CATEGORIES_CONFIG = [
  { id: "all", labelKey: "home.tabs.all", default: "All" },
  { id: "electronics", labelKey: "categories.electronics", default: "Electronics" },
  { id: "fashion", labelKey: "categories.fashion", default: "Fashion" },
  { id: "home", labelKey: "categories.home", default: "Home & Living" },
  { id: "software", labelKey: "categories.software", default: "Software" },
  { id: "beauty", labelKey: "categories.beauty", default: "Beauty" },
  { id: "sports", labelKey: "categories.sports", default: "Sports" },
  { id: "books", labelKey: "categories.books", default: "Books" },
  { id: "automotive", labelKey: "categories.automotive", default: "Automotive" },
  { id: "digital", labelKey: "categories.digital", default: "Digital Goods" },
  { id: "food", labelKey: "categories.food", default: "Food & Beverage" },
] as const;

export function CategoriesBar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [active, setActive] = useState("all");

  const categories = useMemo(
    () =>
      CATEGORIES_CONFIG.map((cat) => ({
        id: cat.id,
        label: t(cat.labelKey, { defaultValue: cat.default }),
      })),
    [t],
  );

  return (
    <div className="flex gap-1 px-[var(--content-padding)] py-3 bg-card border-b border-border overflow-x-auto scrollbar-hide">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => {
            setActive(cat.id);
            if (cat.id !== "all") {
              void navigate(`/search?cat=${cat.id}`);
            } else {
              void navigate("/");
            }
          }}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-[var(--duration-fast)] select-none ${
            active === cat.id
              ? "bg-primary text-white shadow-[0_2px_8px_oklch(from_var(--primary)_l_c_h_/_0.3)]"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

// ─── Navbar ────────────────────────────────────────────────────────────────────
export function Navbar() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useVNShop();
  const { itemCount: cartCount } = useCart();
  const { ids: wishlist } = useWishlist();
  const [searchQ, setSearchQ] = useState("");
  const { suggestions } = useSearchSuggestions(searchQ);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [cartAnnouncement, setCartAnnouncement] = useState("");
  const isMounted = useRef(false);

  // Track scroll for nav shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Announce cart count changes to screen readers, but not on initial mount
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (cartCount === 0) {
      setCartAnnouncement(t("cart.empty"));
    } else {
      setCartAnnouncement(t("cart.itemCount", { count: cartCount }));
    }
  }, [cartCount, t]);

  const closeUserMenu = useCallback(() => {
    setUserMenuOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleDropdownKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!menuRef.current) return;
      const items = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>("button[role='menuitem']"),
      );
      const focused = document.activeElement as HTMLElement;
      const idx = items.indexOf(focused);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeUserMenu();
      }
    },
    [closeUserMenu],
  );

  const handleMobileMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      setMenuOpen(false);
      return;
    }
    if (e.key !== "Tab" || !mobileMenuRef.current) return;
    const focusable = Array.from(
      mobileMenuRef.current.querySelectorAll<HTMLElement>(
        "button, input, a, [tabindex]:not([tabindex='-1'])",
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  const submitSearch = (q: string) => {
    void navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <>
      <LiveRegion message={cartAnnouncement} />

      <nav
        className={`sticky top-0 z-50 flex items-center px-[var(--content-padding)] h-[var(--nav-height)] bg-card/85 backdrop-blur-xl backdrop-saturate-[1.2] border-b border-border transition-shadow duration-[var(--duration-base)] ${
          scrolled ? "shadow-md" : ""
        }`}
      >
        {/* Logo */}
        <Link
          to="/"
          className="shrink-0 text-xl font-extrabold text-primary tracking-tight mr-5 hover:scale-[1.02] transition-transform duration-[var(--duration-fast)]"
          aria-label="VNShop home"
        >
          VNShop
        </Link>

        {/* Search — desktop */}
        <div className="flex-1 max-w-[560px] hidden sm:block relative">
          <SearchAutocomplete
            value={searchQ}
            onValueChange={setSearchQ}
            suggestions={suggestions}
            onSubmit={submitSearch}
            placeholder={t("search.placeholder", {
              defaultValue: "Search for products, brands, and categories...",
            })}
          />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          <NotificationBell />

          <button
            onClick={() => navigate("/wishlist")}
            className="relative flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-[var(--duration-fast)]"
            title={t("auth.wishlist")}
            aria-label={t("auth.wishlist")}
          >
            <Heart className="w-5 h-5" />
            {wishlist.length > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center animate-bounce-in shadow-[0_0_0_2px_var(--card)]">
                {wishlist.length}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => navigate("/cart")}
            className="relative flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-[var(--duration-fast)]"
            title={t("cart.title")}
            aria-label={t("cart.title")}
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center animate-bounce-in shadow-[0_0_0_2px_var(--card)]">
                {cartCount}
              </span>
            ) : null}
          </button>

          {/* User menu */}
          {isLoggedIn ? (
            <div className="relative ml-1">
              <button
                ref={triggerRef}
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-[var(--radius-md)] hover:bg-muted transition-colors"
                aria-label="Account menu"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <ImageWithFallback
                  src={user?.avatar ?? ""}
                  alt={user?.name ?? ""}
                  className="w-8 h-8 rounded-full object-cover border-2 border-border"
                  placeholder={
                    <div className="w-full h-full rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground bg-primary">
                      {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                  }
                />
                <span className="hidden md:block text-sm font-medium text-foreground max-w-[80px] truncate">
                  {user?.name?.split(" ").pop()}
                </span>
                <ChevronDown className="w-3.5 h-3.5 hidden md:block text-muted-foreground" />
              </button>
              <AnimatePresence>
                {userMenuOpen ? (
                  <motion.div
                    ref={menuRef}
                    role="menu"
                    onKeyDown={handleDropdownKeyDown}
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 rounded-[var(--radius-xl)] shadow-xl border border-border bg-card overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-border">
                      <p className="font-semibold text-sm text-foreground">{user?.name}</p>
                      <p className="text-xs mt-0.5 text-muted-foreground">{user?.email}</p>
                    </div>
                    {[
                      {
                        icon: User,
                        label: t("auth.myAccount"),
                        action: () => void navigate("/profile"),
                      },
                      {
                        icon: Package,
                        label: t("auth.myOrders"),
                        action: () => void navigate("/orders"),
                      },
                      {
                        icon: Heart,
                        label: t("auth.wishlist"),
                        action: () => void navigate("/wishlist"),
                      },
                      {
                        icon: Bell,
                        label: t("auth.notifications"),
                        action: () => void navigate("/notifications"),
                      },
                      {
                        icon: Settings,
                        label: t("auth.settings"),
                        action: () => comingSoon("Settings", t),
                      },
                    ].map((item) => (
                      <button
                        key={item.label}
                        role="menuitem"
                        onClick={() => {
                          item.action();
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left text-foreground"
                      >
                        <item.icon className="w-4 h-4 text-primary" />
                        {item.label}
                      </button>
                    ))}
                    <div className="border-t border-border">
                      <button
                        role="menuitem"
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                          void navigate("/");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-error-light transition-colors text-left text-error"
                      >
                        <LogOut className="w-4 h-4" /> {t("auth.logout")}
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              to="/login"
              className="ml-1 flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-md)] text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              <User className="w-4 h-4" /> {t("auth.login", { defaultValue: "Sign In" })}
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] text-muted-foreground hover:bg-muted"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            ref={mobileMenuRef}
            onKeyDown={handleMobileMenuKeyDown}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-border overflow-hidden bg-card z-40 relative"
          >
            <div className="p-4 space-y-1">
              {/* Mobile search */}
              <div className="mb-3 sm:hidden">
                <SearchAutocomplete
                  value={searchQ}
                  onValueChange={setSearchQ}
                  suggestions={suggestions}
                  onSubmit={(q) => {
                    submitSearch(q);
                    setMenuOpen(false);
                  }}
                  placeholder={t("search.mobilePlaceholder", { defaultValue: "Search..." })}
                />
              </div>
              {[
                { icon: Home, label: t("nav.home"), path: "/" },
                { icon: Package, label: t("auth.myOrders"), path: "/orders" },
                { icon: Heart, label: t("auth.wishlist"), path: "/wishlist" },
                { icon: User, label: t("auth.myAccount"), path: "/profile" },
                { icon: Store, label: t("nav.sellerChannel"), path: "/seller" },
              ].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-foreground hover:bg-muted transition-colors text-sm font-medium text-left"
                >
                  <item.icon className="w-[18px] h-[18px] text-muted-foreground" />
                  {item.label}
                </Link>
              ))}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <LanguageSwitcher />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
