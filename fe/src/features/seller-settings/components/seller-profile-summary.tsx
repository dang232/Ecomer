import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { SellerProfile } from "@/shared/contracts/api/seller";
import { StatusPill } from "@/shared/ui";

interface ProfileFieldProps {
  label: string;
  value: string | number | null | undefined;
}

function ProfileField({ label, value }: ProfileFieldProps) {
  return (
    <>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground font-semibold">{value ?? "—"}</dd>
    </>
  );
}

interface SellerProfileSummaryProps {
  profile: SellerProfile;
}

/**
 * Read-only seller profile summary rendered from the seller-profile contract.
 *
 * Renders: shop name, approval status, tier, vacation mode, bank name, and
 * masked destination (bank + last4 + verificationState).
 *
 * Does NOT render: any editable field, Save button, "coming soon", or
 * plaintext account numbers. Buyer-account fields link to /profile since
 * updateProfile supports those fields.
 */
export function SellerProfileSummary({ profile }: SellerProfileSummaryProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{profile.shopName}</h1>
          <StatusPill
            status={profile.approved ? "approved" : "pending"}
            tone={profile.approved ? "success" : "warning"}
            size="sm"
          />
        </div>
        <Link
          to="/profile"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0"
        >
          {t("seller.settings.manageAccount")}
        </Link>
      </div>

      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <ProfileField label={t("seller.settings.tier")} value={profile.tier} />

        <ProfileField
          label={t("seller.settings.vacationMode")}
          value={
            profile.vacationMode
              ? t("seller.settings.vacationOn")
              : t("seller.settings.vacationOff")
          }
        />

        <ProfileField
          label={t("seller.settings.bank")}
          value={profile.bankName ?? t("common.notProvided")}
        />

        {profile.destination ? (
          <>
            <ProfileField
              label={t("seller.settings.destination")}
              value={(profile.destination as { last4: string }).last4}
            />
            <ProfileField
              label={t("seller.settings.verificationState")}
              value={(profile.destination as { verificationState: string }).verificationState}
            />
            <ProfileField
              label={t("seller.settings.destinationBank")}
              value={(profile.destination as { bankName: string }).bankName}
            />
          </>
        ) : (
          <>
            <ProfileField
              label={t("seller.settings.destination")}
              value={t("common.notProvided")}
            />
            <ProfileField
              label={t("seller.settings.verificationState")}
              value={t("common.notProvided")}
            />
          </>
        )}
      </dl>
    </div>
  );
}
