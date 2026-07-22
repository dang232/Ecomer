import {
  IconAlertCircle,
  IconActivity,
  IconLayoutDashboard,
  IconPackage,
  IconStar,
  IconTag,
  IconUserSearch,
  IconUsers,
  IconVideo,
  IconWallet,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  adminListSellers,
  adminOpenDisputes,
  adminPendingPayouts,
  adminPendingReviews,
  adminVideoAppealsQueue,
  adminVideoModerationQueue,
} from "../../lib/api/endpoints/admin";

import { AdminDashboard } from "./AdminDashboard";
import { CouponsManagement } from "./CouponsManagement";
import { DisputesQueue } from "./DisputesQueue";
import { OrderManagement } from "./OrderManagement";
import { PayoutsQueue } from "./PayoutsQueue";
import { ReviewsModeration } from "./ReviewsModeration";
import { SellersApproval } from "./SellersApproval";
import { SystemHealth } from "./SystemHealth";
import { UserManagement } from "./UserManagement";
import { VideoModerationPanel } from "./VideoModerationPanel";

type AdminTab =
  | "dashboard"
  | "sellers"
  | "reviews"
  | "coupons"
  | "disputes"
  | "payouts"
  | "users"
  | "orders"
  | "health"
  | "videoModeration";

const NAV_ITEMS: { id: AdminTab; labelKey: string; icon: typeof IconLayoutDashboard }[] = [
  { id: "dashboard", labelKey: "admin.nav.dashboard", icon: IconLayoutDashboard },
  { id: "sellers", labelKey: "admin.nav.sellers", icon: IconUsers },
  { id: "reviews", labelKey: "admin.nav.reviews", icon: IconStar },
  { id: "videoModeration", labelKey: "admin.nav.videoModeration", icon: IconVideo },
  { id: "coupons", labelKey: "admin.nav.coupons", icon: IconTag },
  { id: "disputes", labelKey: "admin.nav.disputes", icon: IconAlertCircle },
  { id: "payouts", labelKey: "admin.nav.payouts", icon: IconWallet },
  { id: "users", labelKey: "admin.nav.users", icon: IconUserSearch },
  { id: "orders", labelKey: "admin.nav.orders", icon: IconPackage },
  { id: "health", labelKey: "admin.nav.health", icon: IconActivity },
];

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const { t } = useTranslation();

  // Pull pending counts for sidebar badges (best effort).
  const sellersQuery = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: () => adminListSellers(),
    retry: false,
  });
  const reviewsQuery = useQuery({
    queryKey: ["admin", "reviews", "pending"],
    queryFn: () => adminPendingReviews(),
    retry: false,
  });
  const disputesQuery = useQuery({
    queryKey: ["admin", "disputes"],
    queryFn: () => adminOpenDisputes(),
    retry: false,
  });
  const payoutsQuery = useQuery({
    queryKey: ["admin", "payouts", "pending"],
    queryFn: () => adminPendingPayouts(),
    retry: false,
  });
  // BA audit 2026-06-16 P1-13: pending counts for video moderation Queue + Appeals
  const videoModerationQuery = useQuery({
    queryKey: ["admin", "videos", "moderation-queue", "count"],
    queryFn: () => adminVideoModerationQueue({ page: 0, size: 1 }),
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const videoAppealsQuery = useQuery({
    queryKey: ["admin", "videos", "appeal-queue", "count"],
    queryFn: adminVideoAppealsQueue,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const badges = useMemo(
    () => ({
      sellers: sellersQuery.data?.length ?? 0,
      reviews: reviewsQuery.data?.length ?? 0,
      disputes: disputesQuery.data?.length ?? 0,
      payouts: payoutsQuery.data?.length ?? 0,
      videoModeration: videoModerationQuery.data?.totalElements ?? 0,
      videoAppeals: videoAppealsQuery.data?.totalElements ?? 0,
    }),
    [
      sellersQuery.data,
      reviewsQuery.data,
      disputesQuery.data,
      payoutsQuery.data,
      videoModerationQuery.data,
      videoAppealsQuery.data,
    ],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <nav className="hidden md:block w-56 shrink-0">
            <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
              {NAV_ITEMS.map((item) => {
                const badge =
                  item.id === "sellers"
                    ? badges.sellers
                    : item.id === "reviews"
                      ? badges.reviews
                      : item.id === "disputes"
                        ? badges.disputes
                        : item.id === "payouts"
                          ? badges.payouts
                          : item.id === "videoModeration"
                            ? badges.videoModeration + badges.videoAppeals
                            : 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    aria-label={
                      badge > 0
                        ? t("admin.nav.ariaLabelWithBadge", {
                            label: t(item.labelKey),
                            count: badge,
                          })
                        : t(item.labelKey)
                    }
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-all text-left border-b border-gray-50 last:border-0"
                    style={{
                      background:
                        activeTab === item.id
                          ? "rgb(var(--admin-primary-rgb) / 0.08)"
                          : "transparent",
                      color: activeTab === item.id ? "var(--admin-primary)" : "var(--admin-muted)",
                      borderLeft:
                        activeTab === item.id
                          ? "3px solid var(--admin-primary)"
                          : "3px solid transparent",
                    }}
                  >
                    <item.icon size={18} aria-hidden="true" />
                    <span className="flex-1">{t(item.labelKey)}</span>
                    {badge > 0 ? (
                      <span
                        aria-hidden="true"
                        className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                        style={{ background: "var(--admin-primary)" }}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="md:hidden flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide w-full">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                style={
                  activeTab === item.id
                    ? { background: "var(--admin-primary)", color: "white" }
                    : {
                        background: "white",
                        color: "var(--admin-muted)",
                        border: "1px solid var(--admin-border)",
                      }
                }
              >
                <item.icon size={14} /> {t(item.labelKey)}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "dashboard" ? <AdminDashboard /> : null}
              {activeTab === "sellers" ? <SellersApproval /> : null}
              {activeTab === "reviews" ? <ReviewsModeration /> : null}
              {activeTab === "coupons" ? <CouponsManagement /> : null}
              {activeTab === "disputes" ? <DisputesQueue /> : null}
              {activeTab === "payouts" ? <PayoutsQueue /> : null}
              {activeTab === "users" ? <UserManagement /> : null}
              {activeTab === "orders" ? <OrderManagement /> : null}
              {activeTab === "health" ? <SystemHealth /> : null}
              {activeTab === "videoModeration" ? <VideoModerationPanel /> : null}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
