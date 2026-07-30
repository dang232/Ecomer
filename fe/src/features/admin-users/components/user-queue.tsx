import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { AdminRecordDrawer } from "@/features/admin";
import { ApiError } from "@/shared/api";
import { adminListUsers, adminBanUser, adminUnbanUser } from "@/shared/api/endpoints/admin";
import type { User } from "@/shared/contracts/api";

import { UserDetailDrawer } from "./user-detail-drawer";

interface UserQueueProps {
  q?: string;
  page?: number;
  selected?: string;
  onSearch?: (q: string) => void;
  onPageChange?: (page: number) => void;
  onSelect?: (id: string | null) => void;
}

export function AdminUserQueue({
  q,
  page = 1,
  selected,
  onSearch,
  onPageChange,
  onSelect,
}: UserQueueProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState(q ?? "");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "users", { q, page }],
    queryFn: () => adminListUsers({ q, page: (page ?? 1) - 1 }),
    retry: false,
  });

  const users: User[] = data?.data ?? [];
  const total = data?.total ?? 0;

  const ban = useMutation({
    mutationFn: (id: string) => adminBanUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(t("admin.users.banOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.users.banErr")),
  });

  const unban = useMutation({
    mutationFn: (id: string) => adminUnbanUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(t("admin.users.unbanOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.users.unbanErr")),
  });

  const isMutating = ban.isPending || unban.isPending;

  const handleSearch = (value: string) => {
    setSearch(value);
    onSearch?.(value);
  };

  const selectedUser = selected ? users.find((u) => u.id === selected) : null;

  return (
    <>
      <AdminRecordDrawer
        open={!!selected}
        onOpenChange={(open) => { if (!open) onSelect?.(null); }}
        title={selectedUser?.name ?? t("admin.users.drawer.title")}
      >
        {selectedUser ? (
          <UserDetailDrawer userId={selectedUser.id} />
        ) : null}
      </AdminRecordDrawer>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(search); }}
              placeholder={t("admin.users.searchPlaceholder") ?? "Search users..."}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            {t("admin.users.loading")}
          </div>
        ) : isError ? (
          <div className="px-5 py-8 text-center text-sm text-red-500">
            {t("admin.users.loadErr")}
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            {t("admin.users.empty")}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                {[
                  t("admin.users.th.name") ?? "Name",
                  t("admin.users.th.email") ?? "Email",
                  t("admin.users.th.role") ?? "Role",
                  t("admin.users.th.status") ?? "Status",
                  t("admin.users.th.joined") ?? "Joined",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted">
                  <td className="px-4 py-3 text-sm font-semibold">{user.name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                    {user.role?.toLowerCase() ?? "buyer"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{
                        background: user.banned
                          ? "var(--error-light)"
                          : "var(--success-light)",
                        color: user.banned ? "var(--error)" : "var(--success)",
                      }}
                    >
                      {user.banned
                        ? (t("admin.users.banned") ?? "Banned")
                        : (t("admin.users.active") ?? "Active")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelect?.(user.id)}
                        disabled={isMutating}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {t("admin.users.view")}
                      </button>
                      {user.banned ? (
                        <button
                          onClick={() => unban.mutate(user.id)}
                          disabled={isMutating}
                          className="rounded-lg border border-green-200 px-2.5 py-1 text-xs font-semibold text-green-600 hover:bg-green-50 disabled:opacity-50"
                        >
                          {t("admin.users.unban")}
                        </button>
                      ) : (
                        <button
                          onClick={() => ban.mutate(user.id)}
                          disabled={isMutating}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          {t("admin.users.ban")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > 10 ? (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => onPageChange?.(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                {t("common.prev")}
              </button>
              <button
                onClick={() => onPageChange?.(page + 1)}
                disabled={page * 10 >= total}
                className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
