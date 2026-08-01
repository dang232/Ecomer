/**
 * SellerSettingsRoute — Plan 07 direct-route adapter.
 * Bridges the `/seller/settings` route to the feature component.
 */

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { SellerProfileSummary } from "@/features/seller-settings";
import { ApiError } from "@/shared/api";
import { sellerProfile } from "@/shared/api/endpoints/users";

export function SellerSettingsRoute() {
  const { t } = useTranslation();

  const profileQuery = useQuery({
    queryKey: ["seller", "profile"],
    queryFn: sellerProfile,
    retry: false,
  });

  return (
    <div className="space-y-6">
      {profileQuery.error instanceof ApiError ? (
        <p className="text-sm text-red-500">{profileQuery.error.message}</p>
      ) : null}
      {profileQuery.data ? (
        <SellerProfileSummary profile={profileQuery.data} />
      ) : profileQuery.isLoading ? null : (
        <p className="text-sm text-muted-foreground">{t("common.unavailable")}</p>
      )}
    </div>
  );
}
