import { Outlet } from "react-router";

import { ConsoleChrome } from "../components/console-chrome";

import { ConsoleLayoutFooter } from "./ConsoleLayoutFooter";

export function SellerLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ConsoleChrome persona="seller" />
      <main id="main-content" className="flex-1 animate-fade-in">
        <Outlet />
      </main>
      <ConsoleLayoutFooter />
    </div>
  );
}
