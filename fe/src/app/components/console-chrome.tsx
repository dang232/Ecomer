import {
  IconChevronDown,
  IconLayoutDashboard,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSparkles,
  IconSun,
  IconUser,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { ImageWithFallback } from "./image-with-fallback";
import { LanguageSwitcher } from "./language-switcher";
import { useVNShop } from "./vnshop-context";

/**
 * Thin chrome for back-office routes (/admin/*, /seller/*).
 *
 * Why a second chrome: the storefront `Navbar` carries categories,
 * search, wishlist, and cart — all useless to a back-office user and
 * a constant source of UX friction. Admin and seller consoles need
 * just the brand mark, the persona label, the language + theme
 * switchers, and the user menu.
 *
 * Renders `null` outside `/admin*` and `/seller*` — `Root` decides
 * which chrome to render based on pathname.
 */
export function ConsoleChrome({ persona }: { persona: "admin" | "seller" }) {
  const navigate = useNavigate();
  const { user, logout, isDark, toggleTheme } = useVNShop();
  const { t } = useTranslation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const personaLabel =
    persona === "admin" ? t("consoleChrome.adminLabel") : t("consoleChrome.sellerLabel");

  return (
    <header
      className="sticky top-0 z-50 w-full bg-card border-b border-border shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 shrink-0"
          aria-label={t("consoleChrome.backToStorefront")}
        >
          <IconSparkles size={20} style={{ color: "var(--primary)" }} />
          <span
            className="font-bold text-base text-foreground"
            style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
          >
            VNShop
          </span>
        </button>

        <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          <IconLayoutDashboard size={12} />
          {personaLabel}
        </span>

        <div className="flex-1" />

        <button
          onClick={toggleTheme}
          aria-label={isDark ? t("nav.lightMode") : t("nav.darkMode")}
          aria-pressed={isDark}
          className="hidden md:flex items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>

        <LanguageSwitcher />

        {user ? (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-label="User menu"
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
            >
              <ImageWithFallback
                src={user.avatar ?? ""}
                alt={user.name ?? ""}
                className="w-8 h-8 rounded-full object-cover"
                placeholder={
                  <div
                    className="w-full h-full rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: "var(--primary)" }}
                  >
                    {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                }
              />
              <span className="hidden md:block text-sm font-medium max-w-[100px] truncate text-foreground">
                {user.name?.split(" ").pop()}
              </span>
              <IconChevronDown size={14} className="hidden md:block text-muted-foreground" />
            </button>
            <AnimatePresence>
              {userMenuOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 rounded-2xl shadow-2xl border border-border bg-card overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-border">
                    <p className="font-semibold text-sm text-foreground">{user.name}</p>
                    <p className="text-xs mt-0.5 text-muted-foreground">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      void navigate("/");
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left text-foreground"
                  >
                    <IconUser size={16} style={{ color: "var(--primary)" }} />
                    {t("consoleChrome.backToStorefront")}
                  </button>
                  <button
                    onClick={() => {
                      void navigate("/profile");
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left text-foreground"
                  >
                    <IconSettings size={16} style={{ color: "var(--primary)" }} />
                    {t("auth.myAccount")}
                  </button>
                  <div className="border-t border-border">
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                        void navigate("/");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red-500/10 transition-colors text-left text-red-500"
                    >
                      <IconLogout size={16} /> {t("auth.logout")}
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </header>
  );
}
