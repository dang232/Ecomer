import type { TFunction } from "i18next";
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

const DASHBOARD: NavItem = {
  id: "dashboard",
  labelKey: "seller.nav.dashboard",
  icon: LayoutDashboard,
  href: "/seller",
};
const ORDERS: NavItem = {
  id: "orders",
  labelKey: "seller.nav.orders",
  icon: ShoppingBag,
  href: "/seller/orders",
};
const PRODUCTS: NavItem = {
  id: "products",
  labelKey: "seller.nav.products",
  icon: Package,
  href: "/seller/products",
};
const RETURNS: NavItem = {
  id: "returns",
  labelKey: "seller.nav.returns",
  icon: RotateCcw,
  href: "/seller/returns",
};
const REVIEWS: NavItem = {
  id: "reviews",
  labelKey: "seller.nav.reviews",
  icon: Star,
  href: "/seller/reviews",
};
const WALLET: NavItem = {
  id: "wallet",
  labelKey: "seller.nav.wallet",
  icon: Wallet,
  href: "/seller/wallet",
};
const SETTINGS: NavItem = {
  id: "settings",
  labelKey: "seller.nav.settings",
  icon: Settings,
  href: "/seller/settings",
};

const MOBILE_PRIMARY = [DASHBOARD, ORDERS, PRODUCTS, WALLET] as const;
const MOBILE_OVERFLOW = [RETURNS, REVIEWS, SETTINGS] as const;
const DESKTOP_GROUPS = [
  { labelKey: "seller.nav.sectionOperate", items: [DASHBOARD, ORDERS, RETURNS] },
  { labelKey: "seller.nav.sectionGrow", items: [PRODUCTS, REVIEWS] },
  { labelKey: "seller.nav.sectionMoney", items: [WALLET] },
  { labelKey: "seller.nav.sectionShop", items: [SETTINGS] },
] as const;

const SIDE_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  [
    "flex min-h-[var(--target-web)] items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-[13px] font-medium transition-colors",
    isActive
      ? "bg-primary-light text-primary font-semibold"
      : "text-text-secondary hover:bg-background hover:text-foreground",
  ].join(" ");

const BOTTOM_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  [
    "relative flex min-h-[var(--target-web)] min-w-[var(--target-web)] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-2 text-[11px] font-medium transition-colors",
    isActive ? "bg-primary-light text-primary" : "text-text-secondary hover:bg-background",
  ].join(" ");

function itemLabel(t: TFunction, item: NavItem, pendingCount: number) {
  if (item.id === "orders" && pendingCount > 0) {
    return t("seller.nav.ordersWithCount", { count: pendingCount });
  }
  return t(item.labelKey);
}

function DesktopSidebarLink({
  item,
  end,
  pendingCount,
}: {
  item: NavItem;
  end?: boolean;
  pendingCount: number;
}) {
  const { t } = useTranslation();
  const label = itemLabel(t, item, pendingCount);
  return (
    <NavLink to={item.href} end={end} aria-label={label} className={SIDE_LINK_CLASS}>
      {({ isActive }) => (
        <>
          <item.icon size={16} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
          {item.id === "orders" && pendingCount > 0 ? (
            <span className="rounded-lg bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {pendingCount}
            </span>
          ) : null}
          {isActive ? <span className="sr-only"> (current)</span> : null}
        </>
      )}
    </NavLink>
  );
}

function MobileBottomItem({
  item,
  end,
  pendingCount,
}: {
  item: NavItem;
  end?: boolean;
  pendingCount: number;
}) {
  const { t } = useTranslation();
  return (
    <NavLink
      to={item.href}
      end={end}
      aria-label={itemLabel(t, item, pendingCount)}
      className={BOTTOM_LINK_CLASS}
    >
      <item.icon size={20} aria-hidden="true" />
      <span>{t(item.labelKey)}</span>
      {item.id === "orders" && pendingCount > 0 ? (
        <span className="absolute right-1 top-1 rounded-lg bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {pendingCount}
        </span>
      ) : null}
    </NavLink>
  );
}

export function SellerNav({ pendingCount }: { pendingCount: number }) {
  const { t } = useTranslation();
  const location = useLocation();

  const isActive = (href: string) =>
    href === "/seller" ? location.pathname === "/seller" : location.pathname.startsWith(href);
  const activeItem = [...MOBILE_PRIMARY, ...MOBILE_OVERFLOW].find((item) => isActive(item.href));
  const ActiveIcon = activeItem?.icon;

  const renderOverflow = (onClose: () => void) => (
    <ul className="space-y-1">
      {MOBILE_OVERFLOW.map((item) => (
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
    <div className="w-0 shrink-0 lg:contents">
      <aside
        aria-label={t("seller.nav.sidebarLabel", { defaultValue: "Seller navigation" })}
        className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card p-5 lg:flex"
      >
        {DESKTOP_GROUPS.map((group, index) => (
          <div key={group.labelKey} className={index === 0 ? undefined : "mt-4"}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t(group.labelKey)}
            </p>
            {group.items.map((item) => (
              <DesktopSidebarLink
                key={item.id}
                item={item}
                end={item.id === "dashboard"}
                pendingCount={pendingCount}
              />
            ))}
          </div>
        ))}
      </aside>

      <div
        aria-label={t("seller.nav.mobileLabel", { defaultValue: "Seller Hub" })}
        className="fixed inset-x-0 top-14 z-40 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 lg:hidden"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t("seller.nav.mobileLabel", { defaultValue: "Seller Hub" })}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          {ActiveIcon ? (
            <ActiveIcon size={16} className="shrink-0 text-primary" aria-hidden="true" />
          ) : null}
          <span className="truncate">
            {activeItem ? t(activeItem.labelKey) : t("seller.nav.dashboard")}
          </span>
        </span>
      </div>

      <nav
        aria-label={t("seller.nav.bottomLabel", { defaultValue: "Seller quick navigation" })}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-center border-t border-border bg-card px-2 py-1 lg:hidden"
      >
        {MOBILE_PRIMARY.map((item) => (
          <MobileBottomItem
            key={item.id}
            item={item}
            end={item.id === "dashboard"}
            pendingCount={pendingCount}
          />
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
              if (typeof document !== "undefined")
                document.activeElement?.dispatchEvent(new Event("blur"));
            })}
          </div>
        </details>
      </nav>
    </div>
  );
}
