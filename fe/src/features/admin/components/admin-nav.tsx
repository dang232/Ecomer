import {
  Activity,
  BadgeCheck,
  Coins,
  LayoutDashboard,
  MessageSquare,
  Scale,
  ShoppingCart,
  TicketPercent,
  Users,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

type AdminNavItem = {
  id: string;
  labelKey: string;
  href: string;
  icon: LucideIcon;
};

type AdminNavGroup = {
  labelKey: string;
  items: readonly AdminNavItem[];
};

const GROUPS: readonly AdminNavGroup[] = [
  {
    labelKey: "admin.nav.sectionOverview",
    items: [
      { id: "dashboard", labelKey: "admin.nav.dashboard", href: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    labelKey: "admin.nav.sectionCommerce",
    items: [
      { id: "orders", labelKey: "admin.nav.orders", href: "/admin/orders", icon: ShoppingCart },
      { id: "coupons", labelKey: "admin.nav.coupons", href: "/admin/coupons", icon: TicketPercent },
    ],
  },
  {
    labelKey: "admin.nav.sectionTrust",
    items: [
      { id: "sellers", labelKey: "admin.nav.sellers", href: "/admin/sellers", icon: BadgeCheck },
      { id: "reviews", labelKey: "admin.nav.reviews", href: "/admin/reviews", icon: MessageSquare },
      { id: "video", labelKey: "admin.nav.videoModeration", href: "/admin/video", icon: Video },
      { id: "disputes", labelKey: "admin.nav.disputes", href: "/admin/disputes", icon: Scale },
    ],
  },
  {
    labelKey: "admin.nav.sectionFinance",
    items: [{ id: "payouts", labelKey: "admin.nav.payouts", href: "/admin/payouts", icon: Coins }],
  },
  {
    labelKey: "admin.nav.sectionUsersSystem",
    items: [
      { id: "users", labelKey: "admin.nav.users", href: "/admin/users", icon: Users },
      { id: "health", labelKey: "admin.nav.health", href: "/admin/health", icon: Activity },
    ],
  },
];

const LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  [
    "flex min-h-[var(--target-web)] items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-[13px] font-medium transition-colors",
    isActive
      ? "bg-primary-light text-primary font-semibold"
      : "text-text-secondary hover:bg-background hover:text-foreground",
  ].join(" ");

const MOBILE_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  [
    "flex min-h-[var(--target-web)] shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-xs font-medium transition-colors",
    isActive
      ? "bg-primary-light text-primary font-semibold"
      : "border border-border bg-card text-text-secondary",
  ].join(" ");

function AdminLink({ item, mobile = false }: { item: AdminNavItem; mobile?: boolean }) {
  const { t } = useTranslation();
  const className = mobile ? MOBILE_LINK_CLASS : LINK_CLASS;
  return (
    <NavLink
      to={item.href}
      end={item.id === "dashboard"}
      aria-label={t(item.labelKey)}
      className={className}
    >
      <item.icon size={16} aria-hidden="true" />
      <span>{t(item.labelKey)}</span>
    </NavLink>
  );
}

export function AdminNav() {
  const { t } = useTranslation();

  return (
    <>
      <aside
        aria-label={t("admin.nav.sidebarLabel", { defaultValue: "Admin navigation" })}
        className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card p-5 lg:flex"
      >
        {GROUPS.map((group) => (
          <section key={group.labelKey} className="space-y-1">
            <h2 className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-0">
              {t(group.labelKey)}
            </h2>
            {group.items.map((item) => (
              <AdminLink key={item.id} item={item} />
            ))}
          </section>
        ))}
      </aside>

      <nav
        aria-label={t("admin.nav.mobileLabel", { defaultValue: "Admin navigation" })}
        className="flex gap-2 overflow-x-auto px-4 pb-2 pt-4 lg:hidden"
      >
        {GROUPS.flatMap((group) => group.items).map((item) => (
          <AdminLink key={item.id} item={item} mobile />
        ))}
      </nav>
    </>
  );
}
