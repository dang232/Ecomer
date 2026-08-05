import { Outlet } from "react-router";

export function AuthLayout() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <Outlet />
    </main>
  );
}
