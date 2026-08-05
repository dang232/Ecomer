import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Dialog } from "@/shared/ui";

import { useAuth } from "../hooks/auth-context";
import { useAppConfig } from "../hooks/use-app-config";

const FOOTER_DIALOGS = {
  helpCenter: {
    titleKey: "footer.helpCenter",
    descriptionKey: "footer.support.helpCenterDescription",
  },
  shipping: {
    titleKey: "footer.shipping",
    descriptionKey: "footer.support.shippingDescription",
  },
  contact: {
    titleKey: "footer.contactUs",
    descriptionKey: "footer.support.contactDescription",
  },
  about: {
    titleKey: "footer.about",
    descriptionKey: "footer.support.aboutDescription",
  },
  careers: {
    titleKey: "footer.careers",
    descriptionKey: "footer.support.careersDescription",
  },
  blog: {
    titleKey: "footer.blog",
    descriptionKey: "footer.support.blogDescription",
  },
  press: {
    titleKey: "footer.press",
    descriptionKey: "footer.support.pressDescription",
  },
  privacy: {
    titleKey: "footer.privacy",
    descriptionKey: "footer.support.privacyDescription",
  },
  terms: {
    titleKey: "footer.terms",
    descriptionKey: "footer.support.termsDescription",
  },
} as const;

type FooterDialogTopic = keyof typeof FOOTER_DIALOGS;

type FooterAction = { label: string; path: string } | { label: string; topic: FooterDialogTopic };

function FooterActionLink({
  action,
  onOpen,
  className,
}: {
  action: FooterAction;
  onOpen: (topic: FooterDialogTopic) => void;
  className: string;
}) {
  if ("path" in action) {
    return (
      <Link to={action.path} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => onOpen(action.topic)} className={className}>
      {action.label}
    </button>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const { support } = useAppConfig();
  const [supportTopic, setSupportTopic] = useState<FooterDialogTopic | null>(null);
  const activeSupport = supportTopic ? FOOTER_DIALOGS[supportTopic] : null;
  const isSeller = roles.includes("SELLER");
  const linkClassName =
    "inline-block text-sm text-text-secondary transition-all hover:translate-x-0.5 hover:text-primary";
  const sellerLinks: FooterAction[] = isSeller
    ? [
        { label: t("footer.startSelling", { defaultValue: "Start Selling" }), path: "/seller" },
        { label: t("footer.sellerCenter", { defaultValue: "Seller Center" }), path: "/seller" },
        {
          label: t("footer.sellerTools", { defaultValue: "Seller Tools" }),
          path: "/seller/products",
        },
        { label: t("footer.fees", { defaultValue: "Fees" }), path: "/seller/wallet" },
      ]
    : [
        {
          label: t("footer.startSelling", { defaultValue: "Start Selling" }),
          path: "/seller/register",
        },
        {
          label: t("footer.sellerCenter", { defaultValue: "Seller Center" }),
          path: "/seller/register",
        },
        {
          label: t("footer.sellerTools", { defaultValue: "Seller Tools" }),
          path: "/seller/register",
        },
        { label: t("footer.fees", { defaultValue: "Fees" }), path: "/seller/register" },
      ];
  const supportContacts = [
    {
      label: t("footer.support.phone"),
      value: support.phone,
      href: support.phone ? `tel:${support.phone.replace(/[^+\d]/g, "")}` : undefined,
    },
    {
      label: t("footer.support.email"),
      value: support.email,
      href: support.email ? `mailto:${support.email}` : undefined,
    },
    { label: t("footer.support.hours"), value: support.hours },
  ].filter((contact) => contact.value);

  const shopLinks: FooterAction[] = [
    { label: t("footer.allCategories", { defaultValue: "All Categories" }), path: "/search" },
    { label: t("footer.flashDeals", { defaultValue: "Flash Deals" }), path: "/search?flash=true" },
    {
      label: t("footer.newArrivals", { defaultValue: "New Arrivals" }),
      path: "/search?sort=newest",
    },
    {
      label: t("footer.topSellers", { defaultValue: "Top Sellers" }),
      path: "/search?sort=popular",
    },
  ];
  const helpLinks: FooterAction[] = [
    { label: t("footer.helpCenter", { defaultValue: "Help Center" }), topic: "helpCenter" },
    { label: t("footer.returns", { defaultValue: "Returns" }), path: "/returns" },
    { label: t("footer.shipping", { defaultValue: "Shipping & Delivery" }), topic: "shipping" },
    { label: t("footer.contactUs", { defaultValue: "Contact Us" }), topic: "contact" },
  ];
  const companyLinks: FooterAction[] = [
    { label: t("footer.about", { defaultValue: "About" }), topic: "about" },
    { label: t("footer.careers", { defaultValue: "Careers" }), topic: "careers" },
    { label: t("footer.blog", { defaultValue: "Blog & News" }), topic: "blog" },
    { label: t("footer.press", { defaultValue: "Press" }), topic: "press" },
  ];

  return (
    <>
      <footer className="mt-16 border-t border-border bg-background pt-12 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6">
        <div className="max-w-[var(--content-max)] mx-auto px-[var(--content-padding)]">
          <div className="grid grid-cols-1 gap-8 mb-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
            <div>
              <div className="mb-3 text-xl font-extrabold text-primary">VNShop</div>
              <p className="text-sm leading-relaxed text-text-secondary">
                {t("footer.description", {
                  defaultValue:
                    "Vietnam's modern marketplace. Buy and sell anything — electronics, fashion, software, and more. Trusted by millions.",
                })}
              </p>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("footer.shop", { defaultValue: "Shop" })}
              </h4>
              <ul className="space-y-2">
                {shopLinks.map((action) => (
                  <li key={action.label}>
                    <FooterActionLink
                      action={action}
                      onOpen={setSupportTopic}
                      className={linkClassName}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("footer.sell", { defaultValue: "Sell" })}
              </h4>
              <ul className="space-y-2">
                {sellerLinks.map((action) => (
                  <li key={action.label}>
                    <FooterActionLink
                      action={action}
                      onOpen={setSupportTopic}
                      className={linkClassName}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("footer.help", { defaultValue: "Help" })}
              </h4>
              <ul className="space-y-2">
                {helpLinks.map((action) => (
                  <li key={action.label}>
                    <FooterActionLink
                      action={action}
                      onOpen={setSupportTopic}
                      className={linkClassName}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("footer.company", { defaultValue: "Company" })}
              </h4>
              <ul className="space-y-2">
                {companyLinks.map((action) => (
                  <li key={action.label}>
                    <FooterActionLink
                      action={action}
                      onOpen={setSupportTopic}
                      className={linkClassName}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
            <span>{t("footer.copyright")}</span>
            <div className="flex items-center gap-4">
              <FooterActionLink
                action={{
                  label: t("footer.privacy", { defaultValue: "Privacy" }),
                  topic: "privacy",
                }}
                onOpen={setSupportTopic}
                className="transition-colors hover:text-primary"
              />
              <span aria-hidden="true">·</span>
              <FooterActionLink
                action={{ label: t("footer.terms", { defaultValue: "Terms" }), topic: "terms" }}
                onOpen={setSupportTopic}
                className="transition-colors hover:text-primary"
              />
            </div>
          </div>
        </div>
      </footer>

      <Dialog
        open={supportTopic !== null}
        onClose={() => setSupportTopic(null)}
        title={activeSupport ? t(activeSupport.titleKey) : undefined}
        description={activeSupport ? t(activeSupport.descriptionKey) : undefined}
        closeLabel={t("footer.support.close", { defaultValue: "Close" })}
      >
        <div className="space-y-5 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-3">
            <Link
              to="/orders"
              onClick={() => setSupportTopic(null)}
              className="font-medium text-primary hover:underline"
            >
              {t("footer.support.viewOrders")}
            </Link>
            <Link
              to="/returns"
              onClick={() => setSupportTopic(null)}
              className="font-medium text-primary hover:underline"
            >
              {t("footer.support.manageReturns")}
            </Link>
          </div>

          {supportContacts.length > 0 ? (
            <dl className="space-y-3">
              {supportContacts.map((contact) => (
                <div
                  key={contact.label}
                  className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4"
                >
                  <dt className="font-medium text-foreground">{contact.label}</dt>
                  <dd>
                    {contact.href ? (
                      <a className="text-primary hover:underline" href={contact.href}>
                        {contact.value}
                      </a>
                    ) : (
                      contact.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>{t("footer.support.unavailable")}</p>
          )}
        </div>
      </Dialog>
    </>
  );
}
