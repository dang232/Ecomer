import { Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Outlet, useNavigate, useLocation } from "react-router";

import { ConsoleChrome } from "../components/console-chrome";
import { Footer } from "../components/footer";
import { AnnouncementBar, CategoriesBar, Navbar } from "../components/navbar";
import { useVNShop } from "../hooks/use-vnshop";

// ─── Dark Mode Floating Toggle ─────────────────────────────────────────────────
function DarkModeToggle() {
  const { isDark, toggleTheme } = useVNShop();
  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-11 h-11 rounded-full bg-card border border-border hidden md:flex items-center justify-center shadow-lg text-muted-foreground hover:text-primary hover:border-primary hover:scale-110 hover:rotate-[15deg] hover:shadow-xl active:scale-95 transition-all duration-[var(--duration-base)]"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

// ─── Root Layout ───────────────────────────────────────────────────────────────
export function Root() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const isAdminRoute = location.pathname.startsWith("/admin");
  const isSellerRoute = location.pathname.startsWith("/seller");
  const isConsoleRoute = isAdminRoute || isSellerRoute;
  const isAuthRoute =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/password-reset";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {isConsoleRoute ? (
        <ConsoleChrome persona={isAdminRoute ? "admin" : "seller"} />
      ) : isAuthRoute ? null : (
        <>
          <AnnouncementBar />
          <Navbar />
          <CategoriesBar />
        </>
      )}

      <main className="flex-1 animate-fade-in">
        <Outlet />
      </main>

      {/* Footer */}
      {isConsoleRoute ? (
        <footer className="mt-12 border-t border-border bg-card">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("footer.copyright")}</span>
            <button
              onClick={() => navigate("/")}
              className="hover:text-foreground transition-colors"
            >
              {t("consoleChrome.backToStorefront")} →
            </button>
          </div>
        </footer>
      ) : isAuthRoute ? null : (
        <Footer />
      )}

      {/* Floating dark mode toggle — shown on storefront pages */}
      {!isConsoleRoute ? <DarkModeToggle /> : null}
    </div>
  );
}
