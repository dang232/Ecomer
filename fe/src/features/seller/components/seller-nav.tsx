import {
  LayoutDashboard,
  Package,
  RotateCcw,
  Settings,
  ShoppingBag,
  Star,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";

type SellerTab =
  "dashboard" | "products" | "orders" | "returns" | "reviews" | "wallet" | "settings";

interface NavItem {
  id: SellerTab;
  labelKey: string;
  icon: LucideIcon;
  href: string;
}

const PRIMARY: NavItem[] = [
  { id: "dashboard", labelKey: "seller.nav.dashboard", icon: LayoutDashboard, href: "/seller" },
  { id: "orders", labelKey: "seller.nav.orders", icon: ShoppingBag, href: "/seller/orders" },
  { id: "products", labelKey: "seller.nav.products", icon: Package, href: "/seller/products" },
  { id: "wallet", labelKey: "seller.nav.wallet", icon: Wallet, href: "/seller/wallet" },
];

const OVERFLOW: NavItem[] = [
  { id: "returns", labelKey: "return.seller.title", icon: RotateCcw, href: "/seller/returns" },
  { id: "reviews", labelKey: "seller.nav.reviews", icon: Star, href: "/seller/reviews" },
  { id: "settings", labelKey: "seller.nav.settings", icon: Settings, href: "/seller/settings" },
];

const SIDE_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  [
    "flex min-h-[var(--target-web)] items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-[13px] font-medium transition-colors",
    isActive
      ? "bg-primary-light text-primary font-semibold"
      : "text-text-secondary hover:bg-background hover:text-foreground",
  ].join(" ");

const BOTTOM_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  [
    "flex min-h-[var(--target-web)] min-w-[var(--target-web)] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-2 text-[11px] font-medium transition-colors",
    isActive ? "bg-primary-light text-primary" : "text-text-secondary hover:bg-background",
  ].join(" ");

const TOP_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  [
    "flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-xs font-medium transition-colors",
    isActive
      ? "bg-primary-light text-primary font-semibold"
      : "border border-border bg-card text-text-secondary",
  ].join(" ");

function DesktopSidebarLink({ item, end }: { item: NavItem; end?: boolean }) {
  const { t } = useTranslation();
  return (
    <NavLink to={item.href} end={end} aria-label={t(item.labelKey)} className={SIDE_LINK_CLASS}>
      {({ isActive }) => (
        <>
          <item.icon size={16} aria-hidden="true" />
          <span className="flex-1">{t(item.labelKey)}</span>
          {isActive ? <span className="sr-only"> (current)</span> : null}
        </>
      )}
    </NavLink>
  );
}

function MobileBottomItem({ item, end }: { item: NavItem; end?: boolean }) {
  const { t } = useTranslation();
  return (
    <NavLink to={item.href} end={end} aria-label={t(item.labelKey)} className={BOTTOM_LINK_CLASS}>
      <item.icon size={20} aria-hidden="true" />
      <span>{t(item.labelKey)}</span>
    </NavLink>
  );
}

export function SellerNav({ pendingCount }: { pendingCount: number }) {
  const { t } = useTranslation();
  const location = useLocation();

  const isActive = (href: string) =>
    href === "/seller" ? location.pathname === "/seller" : location.pathname.startsWith(href);

  const renderOverflow = (onClose: () => void) => (
    <ul className="space-y-1">
      {OVERFLOW.map((item) => (
        <li key={item.id}>
          <NavLink
            to={item.href}
            onClick={onClose}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={SIDE_LINK_CLASS}
          >
            <item.icon size={16} aria-hidden="true" />
            <span className="flex-1">{t(item.labelKey)}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {/* Desktop sidebar (≥lg) */}
      <aside
        aria-label={t("seller.nav.sidebarLabel", { defaultValue: "Seller navigation" })}
        className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card p-5 lg:flex"
      >
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("seller.nav.sectionMain", { defaultValue: "Overview" })}
        </p>
        {PRIMARY.map((item) => (
          <div key={item.id} className="relative">
            <DesktopSidebarLink item={item} end={item.id === "dashboard"} />
            {item.id === "orders" && pendingCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white"
              >
                {pendingCount}
              </span>
            ) : null}
          </div>
        ))}

        <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("seller.nav.sectionAccount", { defaultValue: "Account" })}
        </p>
        {OVERFLOW.map((item) => (
          <DesktopSidebarLink key={item.id} item={item} />
        ))}
      </aside>

      {/* Mobile top bar (<lg) */}
      <nav
        aria-label={t("seller.nav.mobileLabel", { defaultValue: "Seller navigation" })}
        className="flex gap-2 overflow-x-auto px-4 pb-2 pt-4 lg:hidden"
      >
        {[...PRIMARY, ...OVERFLOW].map((item) => (
          <NavLink
            key={item.id}
            to={item.href}
            end={item.id === "dashboard"}
            aria-label={t(item.labelKey)}
            className={TOP_LINK_CLASS}
          >
            <item.icon size={13} aria-hidden="true" />
            {t(item.labelKey)}
            {item.id === "orders" && pendingCount > 0 ? (
              <span className="rounded-lg bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {pendingCount}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {/* Mobile bottom nav (<lg) — 4-item primary + overflow drawer */}
      <nav
        aria-label={t("seller.nav.bottomLabel", { defaultValue: "Seller quick navigation" })}
        className="sticky bottom-0 z-30 grid grid-cols-5 items-center border-t border-border bg-card px-2 py-1 lg:hidden"
      >
        {PRIMARY.map((item) => (
          <MobileBottomItem key={item.id} item={item} end={item.id === "dashboard"} />
        ))}
        <details className="relative">
          <summary
            className="flex min-h-[var(--target-web)] min-w-[var(--target-web)] cursor-pointer list-none flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-2 text-[11px] font-medium text-text-secondary transition-colors hover:bg-background [&::-webkit-details-marker]:hidden"
            aria-label={t("seller.nav.moreLabel", { defaultValue: "More" })}
          >
            <Settings size={20} aria-hidden="true" />
            <span>{t("seller.nav.moreLabel", { defaultValue: "More" })}</span>
          </summary>
          <div className="absolute bottom-full right-0 mb-2 w-56 rounded-[var(--radius-lg)] border border-border bg-card p-2 shadow-[var(--shadow-lg)]">
            {renderOverflow(() => {
              if (typeof document !== "undefined") {
                document.activeElement?.dispatchEvent(new Event("blur"));
              }
            })}
          </div>
        </details>
      </nav>
    </>
  );
}
