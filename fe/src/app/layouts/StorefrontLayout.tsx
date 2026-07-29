import { Moon, Sun } from "lucide-react";
import { Outlet } from "react-router";

import { Footer } from "../components/footer";
import { AnnouncementBar, CategoriesBar, Navbar } from "../components/navbar";
import { useVNShop } from "../hooks/use-vnshop";

function DarkModeToggle() {
  const { isDark, toggleTheme } = useVNShop();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed bottom-20 right-4 z-50 hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-all duration-[var(--duration-base)] hover:rotate-[15deg] hover:scale-110 hover:border-primary hover:text-primary hover:shadow-xl active:scale-95 md:bottom-6 md:right-6 md:flex"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

export function StorefrontLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AnnouncementBar />
      <Navbar />
      <CategoriesBar />
      <main id="main-content" className="flex-1 animate-fade-in">
        <Outlet />
      </main>
      <Footer />
      <DarkModeToggle />
    </div>
  );
}
