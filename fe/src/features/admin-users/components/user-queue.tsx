import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { AdminRecordDrawer, useAdminCursorPagination } from "@/features/admin";
import { ApiError, isCursorResetError } from "@/shared/api";
import { adminBanUser, adminUnbanUser } from "@/shared/api/endpoints/admin";
import type { AdminUser } from "@/shared/contracts/api";
import { CursorPagination } from "@/shared/ui";

import { adminUsersCursorQueryOptions } from "../api/query-options";

import { UserDetailDrawer } from "./user-detail-drawer";

interface UserQueueProps {
  q?: string;
  selected?: string;
  onSearch?: (q: string) => void;
  onSelect?: (id: string | null) => void;
}

export function AdminUserQueue({ q, selected, onSearch, onSelect }: UserQueueProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState(q ?? "");
  const cursorPagination = useAdminCursorPagination({ scopeKey: q ?? "" });

  const { data, isLoading, isError, isFetching, error } = useQuery({
    ...adminUsersCursorQueryOptions({
      q: q || undefined,
      cursor: cursorPagination.cursor,
      limit: cursorPagination.pageSize,
    }),
    placeholderData: (previous) => previous,
  });

  const users: AdminUser[] = data?.items ?? [];
  const cursorError = isCursorResetError(error);

  const ban = useMutation({
    mutationFn: (id: string) => adminBanUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(t("admin.users.banOk"));
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t("admin.users.banErr")),
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

  const selectedUser = selected ? users.find((u) => u.keycloakId === selected) : null;

  return (
    <>
      <AdminRecordDrawer
        selectedId={selected ?? null}
        onClose={() => onSelect?.(null)}
        title={selectedUser?.name ?? t("admin.users.drawer.title")}
      >
        {selected ? <UserDetailDrawer userId={selected} /> : null}
      </AdminRecordDrawer>

      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.users.title")}</h1>
        </header>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="search"
                aria-label={t("admin.users.searchPlaceholder")}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch(search);
                }}
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
              {cursorError ? (
                <button type="button" onClick={cursorPagination.reset}>
                  Reset cursor
                </button>
              ) : (
                t("admin.users.loadErr")
              )}
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
                    t("admin.users.th.status") ?? "Status",
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
                  <tr key={user.keycloakId} className="hover:bg-muted">
                    <td className="px-4 py-3 text-sm font-semibold">{user.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{
                          background: user.banned ? "var(--error-light)" : "var(--success-light)",
                          color: user.banned ? "var(--error)" : "var(--success)",
                        }}
                      >
                        {user.banned
                          ? (t("admin.users.banned") ?? "Banned")
                          : (t("admin.users.active") ?? "Active")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelect?.(user.keycloakId)}
                          disabled={isMutating}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                        >
                          {t("admin.users.view")}
                        </button>
                        {user.banned ? (
                          <button
                            onClick={() => unban.mutate(user.keycloakId)}
                            disabled={isMutating}
                            className="rounded-lg border border-green-200 px-2.5 py-1 text-xs font-semibold text-green-600 hover:bg-green-50 disabled:opacity-50"
                          >
                            {t("admin.users.unban")}
                          </button>
                        ) : (
                          <button
                            onClick={() => ban.mutate(user.keycloakId)}
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

          {cursorError ? (
            <div className="border-t border-border px-5 py-3 text-sm text-error">
              <button type="button" onClick={cursorPagination.reset}>
                Reset cursor
              </button>
            </div>
          ) : null}
          <CursorPagination
            itemCount={users.length}
            pageIndex={cursorPagination.pageIndex}
            pageSize={cursorPagination.pageSize}
            hasPrevious={cursorPagination.hasPrevious}
            hasMore={data?.hasMore ?? false}
            isFetching={isFetching}
            onPrevious={cursorPagination.goBack}
            onNext={() => cursorPagination.advance(data?.nextCursor ?? null)}
            onRefresh={() => void qc.invalidateQueries({ queryKey: ["admin", "users", "cursor"] })}
            onPageSizeChange={cursorPagination.setPageSize}
          />
        </div>
      </div>
    </>
  );
}
