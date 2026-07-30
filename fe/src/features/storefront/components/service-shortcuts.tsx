import { MapPin, Store, Ticket, Truck, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { HomeMarketplaceView } from "../model/home-view";

const shortcutIcons = {
  vouchers: Ticket,
  shipping: Truck,
  mall: Store,
  video: Video,
  delivery: MapPin,
};

export interface ServiceShortcutsProps {
  items: HomeMarketplaceView["shortcuts"];
}

export function ServiceShortcuts({ items }: ServiceShortcutsProps) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("storefront.shortcuts.label")}
      className="grid grid-cols-5 border-y border-border py-3"
    >
      {items.map((item) => {
        const Icon = shortcutIcons[item.id];
        return (
          <Link
            key={item.id}
            to={item.href}
            className="flex min-h-[var(--target-web)] flex-col items-center justify-center gap-1 px-1 text-center text-xs font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="line-clamp-2">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
