import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";

import { SellerNav } from "@/features/seller";

import { ConsoleChrome } from "./ConsoleChrome";
import { sellerPendingOrders } from "@/shared/api/endpoints/orders";
import { ConsoleLayoutFooter } from "./ConsoleLayoutFooter";

export function SellerLayout() {
  const { t } = useTranslation();
  const pendingQuery = useQuery({
    queryKey: ["seller", "pending-orders", "shell"],
    queryFn: () => sellerPendingOrders({}),
    refetchInterval: 60_000,
    retry: false,
  });
  const pendingCount = pendingQuery.data?.length ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ConsoleChrome persona="seller" />
      <div className="flex flex-1">
        <SellerNav pendingCount={pendingCount} />
        <main
          id="main-content"
          aria-label={t("seller.nav.mainLabel", { defaultValue: "Seller workspace" })}
          className="min-w-0 flex-1 animate-fade-in"
        >
          <Outlet />
        </main>
      </div>
      <ConsoleLayoutFooter />
    </div>
  );
}
