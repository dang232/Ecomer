import { IconBell } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useAuth } from "../hooks/auth-context";
import { useNotifications } from "../hooks/use-notifications";
import type { Notification } from "@/shared/contracts/api/notification";

import { NotificationIcon } from "./notifications/notification-icon";

function relativeTime(
  iso: string | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t("notificationBell.justNow");
  if (minutes < 60) return t("notificationBell.minutesAgo", { m: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("notificationBell.hoursAgo", { h: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("notificationBell.daysAgo", { d: days });
  return new Date(then).toLocaleDateString("vi-VN");
}

function dateGroup(iso: string, t: (key: string) => string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d >= today) return t("notificationBell.today");
  if (d >= yesterday) return t("notificationBell.yesterday");
  return t("notificationBell.earlier");
}

function groupByDate(
  items: Notification[],
  t: (key: string) => string,
): { label: string; items: Notification[] }[] {
  const groups: Record<string, Notification[]> = {};
  for (const item of items) {
    const key = dateGroup(item.createdAt, t);
    (groups[key] ??= []).push(item);
  }
  const todayLabel = t("notificationBell.today");
  const yesterdayLabel = t("notificationBell.yesterday");
  const earlierLabel = t("notificationBell.earlier");
  return [todayLabel, yesterdayLabel, earlierLabel]
    .filter((k) => groups[k]?.length)
    .map((label) => ({ label, items: groups[label] }));
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const { items, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef(unreadCount);

  // Pulse animation when new notification arrives
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 2000);
      prevUnreadRef.current = unreadCount;
      return () => clearTimeout(timer);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSelect = useCallback(
    (n: Notification) => {
      if (!n.read) markRead(n.id);
      setOpen(false);
      if (n.deepLink) {
        try {
          const url = new URL(n.deepLink, window.location.origin);
          if (url.origin === window.location.origin) {
            void navigate(url.pathname + url.search + url.hash);
            return;
          }
          window.location.href = n.deepLink;
        } catch {
          void navigate(n.deepLink);
        }
      }
    },
    [markRead, navigate],
  );

  // Show only top 10, already sorted by createdAt DESC from the API
  const displayed = items.slice(0, 10);
  const groups = groupByDate(displayed, t);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => {
          if (!authenticated) {
            void navigate("/login?next=%2Fprofile");
            return;
          }
          setOpen((v) => !v);
        }}
        className="relative p-2 text-white rounded-lg hover:bg-white/10 transition-colors"
        title={t("notificationBell.title")}
        aria-label={t("notificationBell.title")}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <IconBell size={22} className={pulse ? "animate-bounce" : ""} />
        {unreadCount > 0 ? (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
            style={{ background: "var(--error)" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open && authenticated ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-card rounded-2xl shadow-xl border border-border overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground">
                {t("notificationBell.title")}
              </h3>
              {unreadCount > 0 ? (
                <button
                  onClick={() => markAllRead()}
                  className="text-[11px] font-medium hover:underline"
                  style={{ color: "var(--primary)" }}
                >
                  {t("notificationBell.markAllRead")}
                </button>
              ) : null}
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                  {t("notificationBell.loading")}
                </p>
              ) : null}

              {!isLoading && groups.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <IconBell size={32} className="mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t("notificationBell.empty")}</p>
                </div>
              ) : null}

              {!isLoading && groups.length > 0
                ? groups.map(({ label, items: groupItems }) => (
                    <div key={label}>
                      <p className="px-4 py-1.5 text-[11px] font-medium text-muted-foreground bg-muted/50 uppercase tracking-wide">
                        {label}
                      </p>
                      {groupItems.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleSelect(n)}
                          className="w-full px-4 py-3 flex gap-3 text-left hover:bg-muted transition-colors"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                            style={{
                              background: !n.read ? "rgba(0,191,179,0.12)" : "var(--muted)",
                            }}
                          >
                            <NotificationIcon type={n.type} size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className="text-sm text-foreground line-clamp-1"
                                style={{ fontWeight: !n.read ? 600 : 400 }}
                              >
                                {n.title}
                              </p>
                              {!n.read ? (
                                <span
                                  className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                                  style={{ background: "oklch(52% 0.2 270)" }}
                                />
                              ) : null}
                            </div>
                            {n.body ? (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {n.body}
                              </p>
                            ) : null}
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {relativeTime(n.createdAt, t)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                : null}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border text-center">
              <button
                onClick={() => {
                  setOpen(false);
                  void navigate("/notifications");
                }}
                className="text-xs font-medium"
                style={{ color: "var(--primary)" }}
              >
                {t("notificationBell.viewAll")}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
