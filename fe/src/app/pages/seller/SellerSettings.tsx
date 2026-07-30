import { useTranslation } from "react-i18next";

import { ApiError } from "@/shared/api";

export function SellerSettings({
  profileData,
  profileError,
}: {
  profileData: unknown;
  profileError: unknown;
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm">
      <h2 className="text-xl font-bold text-foreground mb-3">{t("seller.settings.title")}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t("seller.settings.comingSoon")}</p>
      <div className="space-y-4 text-sm">
        {profileData ? (
          <pre className="bg-muted rounded-xl p-3 text-[11px] overflow-auto">
            {JSON.stringify(profileData, null, 2)}
          </pre>
        ) : null}
        {profileError instanceof ApiError ? (
          <p className="text-sm text-red-500">{profileError.message}</p>
        ) : null}
      </div>
    </div>
  );
}
