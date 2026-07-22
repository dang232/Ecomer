import { IconSearch, IconUserOff, IconUserCheck } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "../../lib/api";
import {
  adminSearchUsers,
  adminBanUser,
  adminUnbanUser,
  adminUserOrders,
} from "../../lib/api/endpoints/admin";
import type { AdminUser, AdminOrderSummary } from "../../types/api";

export function UserManagement() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    content: AdminUser[];
    page: number;
    totalPages: number;
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [orderHistory, setOrderHistory] = useState<{
    userId: string;
    orders: AdminOrderSummary[];
  } | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const ban = useMutation({
    mutationFn: (id: string) => adminBanUser(id),
    onSuccess: (updated) => {
      setResults((prev) =>
        prev
          ? {
              ...prev,
              content: prev.content.map((u) => (u.keycloakId === updated.keycloakId ? updated : u)),
            }
          : null,
      );
      toast.success(t("admin.users.banOk"));
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t("admin.users.banErr")),
  });

  const unban = useMutation({
    mutationFn: (id: string) => adminUnbanUser(id),
    onSuccess: (updated) => {
      setResults((prev) =>
        prev
          ? {
              ...prev,
              content: prev.content.map((u) => (u.keycloakId === updated.keycloakId ? updated : u)),
            }
          : null,
      );
      toast.success(t("admin.users.unbanOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.users.unbanErr")),
  });

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const data = await adminSearchUsers({ q: query.trim(), page: 0, size: 50 });
      setResults(data);
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : t("admin.users.searchErr"));
    } finally {
      setSearching(false);
    }
  }

  async function handleViewOrders(userId: string) {
    setLoadingOrders(true);
    try {
      const orders = await adminUserOrders(userId);
      setOrderHistory({ userId, orders });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("admin.users.ordersErr"));
    } finally {
      setLoadingOrders(false);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">{t("admin.users.title")}</h2>

      <div className="bg-card rounded-2xl shadow-sm p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-2 flex-1 min-w-48">
            <IconSearch size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
              placeholder={t("admin.users.searchPlaceholder")}
              className="flex-1 text-sm outline-none bg-transparent"
              aria-label={t("admin.users.searchPlaceholder")}
            />
          </div>
          <button
            onClick={() => void handleSearch()}
            disabled={searching}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--admin-primary)" }}
          >
            {searching ? t("admin.users.searching") : t("admin.users.search")}
          </button>
        </div>
        {searchError ? <p className="text-sm text-red-600">{searchError}</p> : null}
      </div>

      {results !== null ? (
        results.content.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">{t("admin.users.empty")}</p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {results.content.map((u) => (
                <div
                  key={u.keycloakId}
                  className="px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {u.name ?? u.email ?? t("admin.users.unknownName")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {u.email ? `${u.email} · ` : ""}
                      {u.phone ? u.phone : t("admin.users.noPhone")}
                      {u.banned ? (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">
                          {t("admin.users.banned")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => void handleViewOrders(u.keycloakId)}
                      disabled={loadingOrders}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {t("admin.users.viewOrders")}
                    </button>
                    {u.banned ? (
                      <button
                        onClick={() => unban.mutate(u.keycloakId)}
                        disabled={unban.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: "var(--success)" }}
                      >
                        <IconUserCheck size={13} aria-hidden="true" /> {t("admin.users.unban")}
                      </button>
                    ) : (
                      <button
                        onClick={() => ban.mutate(u.keycloakId)}
                        disabled={ban.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
                      >
                        <IconUserOff size={13} aria-hidden="true" /> {t("admin.users.ban")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {results.totalPages > 1 ? (
              <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
                {t("admin.users.page", { page: results.page + 1, pages: results.totalPages })}
              </p>
            ) : null}
          </div>
        )
      ) : null}

      {orderHistory ? (
        <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {t("admin.users.orderHistoryFor", { id: orderHistory.userId })}
            </h3>
            <button
              onClick={() => setOrderHistory(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {t("admin.users.close")}
            </button>
          </div>
          {orderHistory.orders.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">{t("admin.users.noOrders")}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {orderHistory.orders.map((o) => (
                <div key={o.orderId} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{o.orderId}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.status} · {o.totalAmount?.toLocaleString("vi-VN") ?? "—"} ₫
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString("vi-VN") : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
