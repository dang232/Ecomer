import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";

import { SellerNav } from "@/features/seller";
import { sellerPendingOrders } from "@/shared/api/endpoints/orders";

import { ConsoleChrome } from "./ConsoleChrome";
import { ConsoleLayoutFooter } from "./ConsoleLayoutFooter";

export function SellerLayout() {
  const { t } = useTranslation();
  const pendingQuery = useQuery({
    queryKey: ["seller", "pending-orders"],
    queryFn: () => sellerPendingOrders(),
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
          className="min-w-0 flex-1 bg-background pb-20 pt-14 animate-fade-in lg:pb-0 lg:pt-0"
        >
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <ConsoleLayoutFooter />
    </div>
  );
}
