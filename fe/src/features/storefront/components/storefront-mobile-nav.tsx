import { Home, Search, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

interface MobileNavLink {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  end?: boolean;
}

const links: readonly MobileNavLink[] = [
  { to: "/", labelKey: "storefront.mobileNav.home", icon: Home, end: true },
  { to: "/search", labelKey: "storefront.mobileNav.search", icon: Search },
  { to: "/cart", labelKey: "storefront.mobileNav.cart", icon: ShoppingBag },
  { to: "/profile", labelKey: "storefront.mobileNav.account", icon: User },
] as const;

export function StorefrontMobileNav() {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("storefront.mobileNav.label")}
      className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(3.75rem+env(safe-area-inset-bottom))] grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {links.map(({ to, labelKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-[var(--target-web)] flex-col items-center justify-center gap-1 text-xs font-medium ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`
          }
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          {t(labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
