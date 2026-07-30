import { useTranslation } from "react-i18next";

import { SellerProfileSummary } from "@/features/seller-settings";
import { ApiError } from "@/shared/api";
import type { SellerProfile } from "@/shared/contracts/api/seller";

/**
 * SellerSettings — thin wrapper that delegates rendering to the feature component.
 * The seller profile contract is read-only; no update endpoint exists.
 */
export function SellerSettings({
  profileData,
  profileError,
}: {
  profileData: unknown;
  profileError: unknown;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {profileError instanceof ApiError ? (
        <p className="text-sm text-red-500">{profileError.message}</p>
      ) : null}
      {profileData ? (
        <SellerProfileSummary profile={profileData as SellerProfile} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("common.unavailable")}</p>
      )}
    </div>
  );
}
