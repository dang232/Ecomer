import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import { sellerPendingOrders } from "@/shared/api/endpoints/orders";
import { myPayouts, myWallet } from "@/shared/api/endpoints/seller-finance";
import { getSeller } from "@/shared/api/endpoints/sellers";
import { sellerProfile } from "@/shared/api/endpoints/users";

import { SellerDashboard } from "./SellerDashboard";
import { SellerOrders } from "./SellerOrders";
import { SellerProducts } from "./SellerProducts";
import { SellerReturns } from "./SellerReturns";
import { SellerReviews } from "./SellerReviews";
import { SellerSettings } from "./SellerSettings";
import { SellerWallet } from "./SellerWallet";

type SellerTab =
  | "dashboard"
  | "products"
  | "orders"
  | "returns"
  | "reviews"
  | "wallet"
  | "settings";

const SELLER_TAB_PATHS: Record<SellerTab, string> = {
  dashboard: "/seller",
  products: "/seller/products",
  orders: "/seller/orders",
  returns: "/seller/returns",
  reviews: "/seller/reviews",
  wallet: "/seller/wallet",
  settings: "/seller/settings",
};

function sellerTabFromPath(pathname: string): SellerTab {
  return (
    (Object.entries(SELLER_TAB_PATHS).find(([, path]) => path === pathname)?.[0] as
      | SellerTab
      | undefined) ?? "dashboard"
  );
}

export function SellerPage() {
  const [orderSearch, setOrderSearch] = useState("");
  const location = useLocation();
  const activeTab = sellerTabFromPath(location.pathname);
  const { t } = useTranslation();

  const profileQuery = useQuery({
    queryKey: ["seller", "profile"],
    queryFn: sellerProfile,
    retry: false,
  });

  const sellerId = profileQuery.data?.id;
  const publicStatsQuery = useQuery({
    queryKey: ["seller", "public-stats", sellerId],
    queryFn: () => {
      if (!sellerId) throw new Error("A seller ID is required for public statistics");
      return getSeller(sellerId);
    },
    enabled: Boolean(sellerId),
    retry: false,
  });

  const pendingQuery = useQuery({
    queryKey: ["seller", "pending-orders", orderSearch],
    queryFn: () => sellerPendingOrders({ q: orderSearch || undefined }),
    refetchInterval: 60_000,
    retry: false,
  });

  const walletQuery = useQuery({
    queryKey: ["seller", "wallet"],
    queryFn: myWallet,
    retry: false,
  });

  const payoutsQuery = useQuery({
    queryKey: ["seller", "payouts"],
    queryFn: myPayouts,
    retry: false,
  });

  const pendingOrders = useMemo(() => pendingQuery.data ?? [], [pendingQuery.data]);
  const balance = walletQuery.data?.balance ?? null;

  const tabTitle: Record<SellerTab, string> = {
    dashboard: t("seller.nav.dashboard"),
    orders: t("seller.nav.orders"),
    returns: t("return.seller.title"),
    products: t("seller.nav.products"),
    reviews: t("seller.nav.reviews"),
    wallet: t("seller.nav.wallet"),
    settings: t("seller.nav.settings"),
  };

  return (
    <div className="min-w-0 flex-1 bg-background">
      <header className="flex items-center justify-between px-4 pt-6 pb-0 lg:px-8">
        <h1 className="text-xl font-bold text-foreground">{tabTitle[activeTab]}</h1>
      </header>
      <div className="p-4 lg:p-8">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "dashboard" ? (
            <SellerDashboard
              pendingOrders={pendingOrders}
              walletBalance={balance}
              productCount={publicStatsQuery.data?.totalProducts ?? null}
              ratingAvg={publicStatsQuery.data?.ratingAvg ?? null}
              statsLoading={profileQuery.isLoading || publicStatsQuery.isLoading}
            />
          ) : null}
          {activeTab === "products" ? <SellerProducts /> : null}
          {activeTab === "orders" ? (
            <SellerOrders
              orders={pendingOrders}
              search={orderSearch}
              onSearch={setOrderSearch}
              isLoading={pendingQuery.isLoading}
              error={pendingQuery.error}
              onRetry={() => void pendingQuery.refetch()}
            />
          ) : null}
          {activeTab === "returns" ? <SellerReturns /> : null}
          {activeTab === "reviews" ? <SellerReviews /> : null}
          {activeTab === "wallet" ? (
            <SellerWallet
              balance={balance}
              payouts={payoutsQuery.data ?? []}
              isLoading={walletQuery.isLoading}
              error={walletQuery.error}
            />
          ) : null}
          {activeTab === "settings" ? (
            <SellerSettings profileData={profileQuery.data} profileError={profileQuery.error} />
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}