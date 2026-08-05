import { Outlet } from "react-router";

import { StorefrontMobileNav } from "@/features/storefront";

import { Footer } from "../components/footer";
import { Navbar } from "../components/navbar";

export function StorefrontLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main
        id="main-content"
        className="flex-1 animate-fade-in pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0"
      >
        <Outlet />
      </main>
      <Footer />
      <StorefrontMobileNav />
    </div>
  );
}
