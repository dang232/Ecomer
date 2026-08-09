import { Outlet } from "react-router";

import { AdminNav } from "@/features/admin";

import { ConsoleChrome } from "./ConsoleChrome";
import { ConsoleLayoutFooter } from "./ConsoleLayoutFooter";

export function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ConsoleChrome persona="admin" />
      <div className="flex flex-1 flex-col lg:flex-row">
        <AdminNav />
        <main id="main-content" className="min-w-0 flex-1 animate-fade-in">
          <Outlet />
        </main>
      </div>
      <ConsoleLayoutFooter />
    </div>
  );
}
