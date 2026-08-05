import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { adminUserOrders } from "@/shared/api/endpoints/admin";
import type { AdminOrderSummary } from "@/shared/contracts/api";
import { formatPrice } from "@/shared/lib";

interface UserDetailDrawerProps {
  userId: string;
}

export function UserDetailDrawer({ userId }: UserDetailDrawerProps) {
  const { t } = useTranslation();

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["admin", "users", userId, "orders"],
    queryFn: () => adminUserOrders(userId),
    retry: false,
  });

  return (
    <div className="space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("admin.users.drawer.orderHistory")}
      </p>

      {ordersLoading ? (
        <p className="text-sm text-muted-foreground">{t("admin.users.drawer.loadingOrders")}</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.users.drawer.noOrders")}</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order: AdminOrderSummary) => (
            <div
              key={order.orderId}
              className="rounded-lg border border-border p-3 text-sm space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-muted-foreground">
                  {order.orderNumber}
                </span>
                <span className="font-semibold">{formatPrice(order.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground capitalize">
                  {order.status?.toLowerCase() ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
