import {
  IconLayoutDashboard,
  IconPackage,
  IconSettings,
  IconShoppingBag,
  IconStar,
  IconWallet,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { sellerPendingOrders } from "../../lib/api/endpoints/orders";
import { myPayouts, myWallet } from "../../lib/api/endpoints/seller-finance";
import { getSeller } from "../../lib/api/endpoints/sellers";
import { sellerProfile } from "../../lib/api/endpoints/users";

import { SellerDashboard } from "./SellerDashboard";
import { SellerOrders } from "./SellerOrders";
import { SellerProducts } from "./SellerProducts";
import { SellerReviews } from "./SellerReviews";
import { SellerSettings } from "./SellerSettings";
import { SellerWallet } from "./SellerWallet";

type SellerTab = "dashboard" | "products" | "orders" | "reviews" | "wallet" | "settings";

const NAV_MAIN: { id: SellerTab; labelKey: string; icon: typeof IconLayoutDashboard }[] = [
  { id: "dashboard", labelKey: "seller.nav.dashboard", icon: IconLayoutDashboard },
  { id: "orders", labelKey: "seller.nav.orders", icon: IconShoppingBag },
  { id: "products", labelKey: "seller.nav.products", icon: IconPackage },
  { id: "reviews", labelKey: "seller.nav.reviews", icon: IconStar },
];

const NAV_FINANCE: { id: SellerTab; labelKey: string; icon: typeof IconLayoutDashboard }[] = [
  { id: "wallet", labelKey: "seller.nav.wallet", icon: IconWallet },
];

const NAV_ACCOUNT: { id: SellerTab; labelKey: string; icon: typeof IconLayoutDashboard }[] = [
  { id: "settings", labelKey: "seller.nav.settings", icon: IconSettings },
];

const ALL_NAV_ITEMS = [...NAV_MAIN, ...NAV_FINANCE, ...NAV_ACCOUNT];

function NavItem({
  item,
  active,
  onClick,
  badge,
}: {
  item: { id: SellerTab; labelKey: string; icon: typeof IconLayoutDashboard };
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(item.labelKey)}
      aria-current={active ? "page" : undefined}
      className={[
        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] text-[13px] font-medium transition-colors cursor-pointer text-left",
        active
          ? "bg-primary-light text-primary font-semibold"
          : "text-text-secondary hover:bg-background hover:text-foreground",
      ].join(" ")}
    >
      <item.icon size={16} aria-hidden="true" />
      <span className="flex-1">{t(item.labelKey)}</span>
      {badge !== undefined && badge > 0 ? (
        <span className="ml-auto text-[10px] font-semibold bg-accent text-white px-1.5 py-0.5 rounded-lg">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function SellerPage() {
  const [activeTab, setActiveTab] = useState<SellerTab>("dashboard");
  const [orderSearch, setOrderSearch] = useState("");
  const { t } = useTranslation();

  const profileQuery = useQuery({
    queryKey: ["seller", "profile"],
    queryFn: sellerProfile,
    retry: false,
  });

  const sellerId = profileQuery.data?.id;
  const publicStatsQuery = useQuery({
    queryKey: ["seller", "public-stats", sellerId],
    queryFn: () => getSeller(sellerId!),
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
  const sellerName = profileQuery.data?.name ?? t("seller.shopFallback");
  const pendingCount = pendingOrders.length;

  const tabTitle: Record<SellerTab, string> = {
    dashboard: t("seller.nav.dashboard"),
    orders: t("seller.nav.orders"),
    products: t("seller.nav.products"),
    reviews: t("seller.nav.reviews"),
    wallet: t("seller.nav.wallet"),
    settings: t("seller.nav.settings"),
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside
        aria-label={t("seller.nav.sidebarLabel", { defaultValue: "Seller navigation" })}
        className="hidden lg:flex w-[240px] bg-card border-r border-border p-5 flex-col gap-1 sticky top-0 h-screen overflow-y-auto shrink-0"
      >
        {/* Logo */}
        <div className="text-lg font-extrabold text-primary px-3 py-2 mb-5">
          {sellerName.charAt(0).toUpperCase()}
          {sellerName.slice(1)}
        </div>

        {/* MAIN section */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-4 pb-2">
          {t("seller.nav.sectionMain", { defaultValue: "Main" })}
        </p>
        {NAV_MAIN.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={activeTab === item.id}
            onClick={() => setActiveTab(item.id)}
            badge={item.id === "orders" ? pendingCount : undefined}
          />
        ))}

        {/* FINANCE section */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-4 pb-2">
          {t("seller.nav.sectionFinance", { defaultValue: "Finance" })}
        </p>
        {NAV_FINANCE.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={activeTab === item.id}
            onClick={() => setActiveTab(item.id)}
          />
        ))}

        {/* ACCOUNT section */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-4 pb-2">
          {t("seller.nav.sectionAccount", { defaultValue: "Account" })}
        </p>
        {NAV_ACCOUNT.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={activeTab === item.id}
            onClick={() => setActiveTab(item.id)}
          />
        ))}
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 bg-background min-w-0">
        {/* Mobile nav strip */}
        <nav
          aria-label={t("seller.nav.mobileLabel", { defaultValue: "Seller navigation" })}
          className="lg:hidden flex gap-2 px-4 pt-4 pb-2 overflow-x-auto"
        >
          {ALL_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-label={t(item.labelKey)}
              aria-current={activeTab === item.id ? "page" : undefined}
              className={[
                "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-md)] text-xs font-medium transition-colors",
                activeTab === item.id
                  ? "bg-primary-light text-primary font-semibold"
                  : "bg-card border border-border text-text-secondary",
              ].join(" ")}
            >
              <item.icon size={13} aria-hidden="true" />
              {t(item.labelKey)}
              {item.id === "orders" && pendingCount > 0 ? (
                <span className="text-[10px] font-semibold bg-accent text-white px-1.5 py-0.5 rounded-lg">
                  {pendingCount}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {/* Page header */}
        <header className="flex items-center justify-between px-8 pt-8 pb-0">
          <h1 className="text-xl font-bold text-foreground">{tabTitle[activeTab]}</h1>
        </header>

        {/* Page content */}
        <main className="p-8">
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
        </main>
      </div>
    </div>
  );
}
