import { Bell, Heart, MessageSquare, RotateCcw, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";

import {
  ACCOUNT_SECTION_VALUES,
  accountHref,
  readAccountRouteState,
  type AccountSection,
} from "../model/account-route-state";

const SECTION_ICON: Record<AccountSection, typeof User> = {
  profile: User,
  wishlist: Heart,
  notifications: Bell,
  messages: MessageSquare,
  returns: RotateCcw,
};

export function AccountNav() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const current = readAccountRouteState(pathname).section;

  return (
    <nav
      aria-label={t("account.navigation")}
      className="mb-6 overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-card p-2"
    >
      <div className="flex min-w-max gap-2">
        {ACCOUNT_SECTION_VALUES.map((section) => {
          const Icon = SECTION_ICON[section];
          const active = current === section;
          return (
            <Link
              key={section}
              to={accountHref(section)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-[2.75rem] items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon size={16} aria-hidden="true" />
              {t(`account.sections.${section}`)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
