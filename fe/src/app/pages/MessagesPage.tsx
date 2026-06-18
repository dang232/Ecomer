import { IconLoader2, IconSearch, IconSend } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { useAuth } from "../hooks/use-auth";
import { useMarkThreadRead, useMessages, useSendMessage } from "../hooks/use-messages";
import { useThreads } from "../hooks/use-threads";
import { ApiError } from "../lib/api";
import { openThread } from "../lib/api/endpoints/messaging";
import type { ChatMessage, MessageThreadSummary } from "../lib/api/endpoints/messaging";

function useRelativeTime() {
  const { t, i18n } = useTranslation();
  return (iso: string | undefined): string => {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    if (diff < 60_000) return t("messaging.relative.justNow");
    if (diff < 3_600_000)
      return t("messaging.relative.minutesAgo", { m: Math.floor(diff / 60_000) });
    if (diff < 86_400_000)
      return t("messaging.relative.hoursAgo", { h: Math.floor(diff / 3_600_000) });
    return new Date(iso).toLocaleDateString(i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN");
  };
}

function ThreadList({
  threads,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  isLoading,
}: {
  threads: MessageThreadSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => {
      const haystack = [thread.otherPartyId, thread.lastMessageBody ?? "", thread.productId ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [threads, filter]);

  return (
    <aside className="flex flex-col bg-card border-r border-border overflow-y-auto">
      <div className="p-4 border-b border-border">
        <h2 className="text-[15px] font-bold text-foreground">{t("messaging.listHeader")}</h2>
        <label className="mt-3 flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-muted border border-border">
          <IconSearch size={14} className="text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder={t("messaging.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 flex items-center justify-center text-muted-foreground text-sm gap-2">
            <IconLoader2 size={14} className="animate-spin" /> {t("messaging.loading")}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground text-center">{t("messaging.noThreads")}</p>
        ) : (
          filtered.map((thread) => {
            const active = thread.id === selectedId;
            const name = thread.otherPartyUsername ?? `User ${thread.otherPartyId.slice(0, 8)}`;
            const initials = name.slice(0, 2).toUpperCase();
            return (
              <button
                key={thread.id}
                onClick={() => onSelect(thread.id)}
                className={`w-full text-left flex gap-2.5 px-4 py-3 cursor-pointer transition-colors ${
                  active ? "bg-primary-light" : "hover:bg-background"
                }`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center flex-shrink-0 text-xs font-semibold text-foreground">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-foreground truncate">{name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {relativeTime(thread.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[12px] text-muted-foreground truncate flex-1">
                      {thread.lastMessageBody ?? t("messaging.emptyThread")}
                    </span>
                    {thread.unreadCount > 0 ? (
                      <span className="ml-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white bg-primary flex items-center justify-center">
                        {thread.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

function MessageBubble({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "vi-VN";
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] px-3.5 py-2.5 text-sm ${
          isMine
            ? "bg-primary text-white rounded-[var(--radius-lg)] rounded-br-sm self-end"
            : "bg-card border border-border text-foreground rounded-[var(--radius-lg)] rounded-bl-sm self-start"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className="text-[10px] opacity-70 mt-1">
          {new Date(message.sentAt).toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function MessagePane({
  threadId,
  callerId,
}: {
  threadId: string | null;
  callerId: string | undefined;
}) {
  const { t } = useTranslation();
  const messagesQuery = useMessages(threadId ?? undefined);
  const sendMessage = useSendMessage(threadId ?? undefined);
  const markRead = useMarkThreadRead();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Most-recent first from BE; reverse for natural chat order (oldest top, newest bottom).
  const ordered = useMemo(
    () => [...(messagesQuery.data?.content ?? [])].reverse(),
    [messagesQuery.data?.content],
  );

  // Mark thread as read whenever the user opens it (idempotent on the server).
  useEffect(() => {
    if (!threadId) return;
    markRead.mutate(threadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Auto-scroll to the latest message when the cache changes.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [ordered.length]);

  if (!threadId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm bg-background">
        {t("messaging.selectThreadPrompt")}
      </div>
    );
  }

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed || !threadId) return;
    setDraft("");
    sendMessage.mutate(
      { body: trimmed },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("messaging.sendError")),
      },
    );
  };

  const headerLatest = messagesQuery.data?.content?.[0];
  const headerThread = headerLatest?.threadId
    ? t("messaging.headerThread", { id: headerLatest.threadId.slice(0, 8) })
    : t("messaging.headerThreadFallback");
  const headerName = headerThread;
  const initials = headerName.slice(0, 2).toUpperCase();

  return (
    <section className="flex flex-col flex-1 bg-background">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-card border-b border-border">
        <div className="w-9 h-9 rounded-full bg-surface-elevated flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
          {initials}
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground">{headerName}</p>
          <p className="text-[11px] text-success">● Online</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 p-5 overflow-y-auto flex flex-col gap-3">
        {messagesQuery.isLoading ? (
          <p className="text-center text-sm text-muted-foreground">{t("messaging.loadingMessages")}</p>
        ) : ordered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">{t("messaging.noMessagesYet")}</p>
        ) : (
          ordered.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              isMine={m.senderId === callerId || m.senderId === "__pending__"}
            />
          ))
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2 px-5 py-3 bg-card border-t border-border items-end"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={t("messaging.composerPlaceholder")}
          className="flex-1 resize-none rounded-[var(--radius-lg)] border border-border px-4 py-2 text-sm focus:outline-none focus:border-primary bg-background"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sendMessage.isPending}
          aria-label={t("messaging.send")}
          className="w-[38px] h-[38px] rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 disabled:opacity-60"
        >
          {sendMessage.isPending ? (
            <IconLoader2 size={16} className="animate-spin" />
          ) : (
            <IconSend size={16} />
          )}
        </button>
      </form>
    </section>
  );
}

export function MessagesPage() {
  const { ready, authenticated, login, subject } = useAuth();
  const [params, setParams] = useSearchParams();
  const threads = useThreads();
  const [filter, setFilter] = useState("");
  const [resolving, setResolving] = useState(false);
  const { t } = useTranslation();

  const requestedThreadId = params.get("thread");
  const requestedRecipient = params.get("with");
  const requestedProduct = params.get("product");

  // If the URL says ?with=<userId>[&product=<id>], find or create that thread
  // before rendering the pane.
  useEffect(() => {
    if (!ready || !authenticated || !requestedRecipient || requestedThreadId) return;
    let cancelled = false;
    setResolving(true);
    openThread({
      recipientId: requestedRecipient,
      productId: requestedProduct ?? null,
    })
      .then((thread) => {
        if (cancelled) return;
        // Strip the auto-resolve params and stash the thread id so a refresh
        // doesn't re-trigger the resolve.
        const next = new URLSearchParams(params);
        next.delete("with");
        next.delete("product");
        next.set("thread", thread.id);
        setParams(next, { replace: true });
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : t("messaging.openThreadError"));
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, requestedRecipient, requestedThreadId, requestedProduct]);

  // Only treat the URL thread param as selected if it actually exists in the
  // loaded thread list. This prevents the pane from rendering stale/invalid
  // thread content while threads are still loading or after a URL is shared.
  const threadIds = useMemo(
    () => new Set(threads.items.map((t) => t.id)),
    [threads.items],
  );
  const selectedId: string | null = useMemo(() => {
    if (requestedThreadId && threadIds.has(requestedThreadId)) return requestedThreadId;
    // Fall back to the first available thread only when no explicit param is set.
    if (!requestedThreadId) return threads.items.find((t) => !!t.id)?.id ?? null;
    // URL has a threadId but threads haven't loaded yet — keep it so the pane
    // shows a loading state rather than the "select a conversation" placeholder.
    if (threads.isLoading) return requestedThreadId;
    return null;
  }, [requestedThreadId, threadIds, threads.items, threads.isLoading]);

  const selectThread = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("thread", id);
    setParams(next, { replace: false });
  };

  if (ready && !authenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <p className="text-sm text-muted-foreground mb-4">{t("messaging.loginPrompt")}</p>
        <button
          onClick={() => login("/messages")}
          className="px-4 py-2 rounded-xl text-white text-sm font-medium"
          style={{ background: "var(--primary)" }}
        >
          {t("auth.login")}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto py-8 px-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">{t("messaging.pageTitle")}</h1>
      <div className="grid grid-cols-[300px_1fr] border border-border rounded-[var(--radius-xl)] overflow-hidden h-[520px]">
        <ThreadList
          threads={threads.items}
          selectedId={selectedId}
          onSelect={selectThread}
          filter={filter}
          onFilterChange={setFilter}
          isLoading={threads.isLoading || resolving}
        />
        <MessagePane threadId={selectedId} callerId={subject} />
      </div>
    </div>
  );
}
