import { IconArrowsSort, IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { FormDialog } from "../../components/form-dialog";
import { ApiError } from "../../lib/api";
import {
  adminCompletePayout,
  adminCompletedPayouts,
  adminFailPayout,
  adminPendingPayouts,
} from "../../lib/api/endpoints/admin";
import { formatDate, formatPrice } from "../../lib/format";
import { groupByDate } from "../../lib/group-by-date";
import type { AdminPayout } from "../../types/api";

type Tab = "pending" | "completed";
const TABS: Tab[] = ["pending", "completed"];

export function PayoutsQueue() {
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>("pending");
  const [failFor, setFailFor] = useState<string | null>(null);
  const [completeFor, setCompleteFor] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [failProcessingId, setFailProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const pendingBtnRef = useRef<HTMLButtonElement>(null);
  const completedBtnRef = useRef<HTMLButtonElement>(null);
  const tabRefs = { pending: pendingBtnRef, completed: completedBtnRef };

  const pendingQuery = useQuery({
    queryKey: ["admin", "payouts", "pending", search],
    queryFn: () => adminPendingPayouts({ q: search || undefined }),
    retry: false,
  });
  // Completed list is only fetched while its tab is active. The pending
  // tab is the hot path; loading the completed history on every dashboard
  // visit would burn a request the admin doesn't always need.
  const completedQuery = useQuery({
    queryKey: ["admin", "payouts", "completed", search],
    queryFn: () => adminCompletedPayouts({ q: search || undefined }),
    enabled: tab === "completed",
    retry: false,
  });

  const complete = useMutation({
    mutationFn: (id: string) => adminCompletePayout(id),
    onMutate: (id) => setProcessingId(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "payouts"] });
      toast.success(t("admin.payouts.completeOk"));
      setCompleteFor(null);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("admin.payouts.updateErr"));
      // Close the dialog on error too. The BE may have actually succeeded
      // (the response Zod parse can fail even on a 200) — leaving the
      // modal open after a failed-on-FE-but-succeeded-on-BE round-trip
      // strands an admin under an opaque overlay (pt33 race). Re-fetch
      // payouts so the row state reflects whatever the BE thinks.
      void qc.invalidateQueries({ queryKey: ["admin", "payouts"] });
      setCompleteFor(null);
    },
    onSettled: () => setProcessingId(null),
  });

  const fail = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminFailPayout(id, { reason }),
    onMutate: ({ id }) => setFailProcessingId(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "payouts"] });
      toast.success(t("admin.payouts.failOk"));
      setFailFor(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.payouts.updateErr")),
    onSettled: () => setFailProcessingId(null),
  });

  const activeQuery = tab === "pending" ? pendingQuery : completedQuery;
  const activeList = useMemo(() => activeQuery.data ?? [], [activeQuery.data]);
  const completeTarget =
    completeFor && tab === "pending"
      ? (pendingQuery.data?.find((p) => p.id === completeFor) ?? null)
      : null;

  // Completed rows sort on completedAt (when the payout actually settled),
  // pending rows on requestedAt (when the seller filed the request).
  const dateField = useCallback(
    (p: AdminPayout) => (tab === "completed" ? (p.completedAt ?? p.requestedAt) : p.requestedAt),
    [tab],
  );

  const filtered = activeList;

  const sorted = useMemo(() => {
    if (sortBy === "amount") {
      return [...filtered].sort((a, b) => b.amount - a.amount);
    }
    return [...filtered].sort((a, b) => {
      const ta = dateField(a) ? Date.parse(dateField(a)!) : 0;
      const tb = dateField(b) ? Date.parse(dateField(b)!) : 0;
      return tb - ta;
    });
  }, [filtered, sortBy, dateField]);

  // Date sections only when sorted by date — under amount sort the
  // grouping would split the comparison the user is trying to make.
  const sections = useMemo(
    () => (sortBy === "date" ? groupByDate(sorted, dateField, i18n.language) : null),
    [sorted, sortBy, dateField, i18n.language],
  );

  const focusTab = (next: Tab) => {
    setTab(next);
    tabRefs[next].current?.focus();
  };

  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, current: Tab) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusTab(TABS[(TABS.indexOf(current) + 1) % TABS.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusTab(TABS[(TABS.indexOf(current) - 1 + TABS.length) % TABS.length]);
    }
  }

  const isEmptyForTab = !activeQuery.isLoading && activeList.length === 0;
  const emptyKey = tab === "pending" ? "admin.payouts.empty" : "admin.payouts.emptyCompleted";

  return (
    <div className="space-y-5">
      <FormDialog
        open={!!completeTarget}
        title={t("admin.payouts.completeDialog.title")}
        description={
          completeTarget
            ? [
                t("admin.payouts.completeDialog.subtitle", {
                  amount: formatPrice(completeTarget.amount),
                  sellerId: completeTarget.sellerId.slice(0, 8),
                }),
                t("admin.payouts.completeDialog.irreversibleWarning"),
              ]
            : undefined
        }
        submitLabel={t("admin.payouts.completeDialog.submit")}
        submitColor="var(--success)"
        fields={[]}
        onClose={() => setCompleteFor(null)}
        onSubmit={() => {
          if (completeTarget) complete.mutate(completeTarget.id);
        }}
        isSubmitting={complete.isPending}
      />
      <FormDialog
        open={!!failFor}
        title={t("admin.payouts.failDialog.title")}
        description={failFor ? t("admin.payouts.failDialog.subtitle", { id: failFor }) : undefined}
        submitLabel={t("admin.payouts.failDialog.submit")}
        submitColor="var(--error)"
        fields={[
          {
            key: "reason",
            label: t("admin.payouts.failDialog.reasonLabel"),
            placeholder: t("admin.payouts.failDialog.reasonPlaceholder"),
            type: "textarea",
            required: true,
          },
        ]}
        onClose={() => setFailFor(null)}
        onSubmit={({ reason }) => {
          if (failFor) fail.mutate({ id: failFor, reason });
        }}
        isSubmitting={fail.isPending}
      />
      <h2 className="text-xl font-bold text-foreground">{t("admin.payouts.title")}</h2>

      {/* P1-11: roving tabindex + ArrowLeft/ArrowRight keyboard navigation */}
      <div role="tablist" aria-label="Payout tabs" className="flex items-center gap-2">
        <button
          ref={pendingBtnRef}
          role="tab"
          id="payouts-pending-tab"
          aria-selected={tab === "pending"}
          aria-controls="payouts-pending-panel"
          tabIndex={tab === "pending" ? 0 : -1}
          onClick={() => {
            setTab("pending");
            setSearch("");
          }}
          onKeyDown={(e) => handleTabKeyDown(e, "pending")}
          className={
            tab === "pending"
              ? "px-3 py-1.5 rounded-xl text-xs font-semibold bg-foreground text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              : "px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-card text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          }
        >
          {t("admin.payouts.tab.pending")}
        </button>
        <button
          ref={completedBtnRef}
          role="tab"
          id="payouts-completed-tab"
          aria-selected={tab === "completed"}
          aria-controls="payouts-completed-panel"
          tabIndex={tab === "completed" ? 0 : -1}
          onClick={() => {
            setTab("completed");
            setSearch("");
          }}
          onKeyDown={(e) => handleTabKeyDown(e, "completed")}
          className={
            tab === "completed"
              ? "px-3 py-1.5 rounded-xl text-xs font-semibold bg-foreground text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              : "px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-card text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          }
        >
          {t("admin.payouts.tab.completed")}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5 shadow-sm flex-1">
          <IconSearch size={14} className="text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.payouts.searchPlaceholder")}
            className="flex-1 text-sm outline-none bg-transparent"
          />
        </div>
        <button
          onClick={() => setSortBy((s) => (s === "date" ? "amount" : "date"))}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-muted-foreground hover:bg-muted"
        >
          <IconArrowsSort size={13} />
          {sortBy === "date" ? t("admin.payouts.sortByAmount") : t("admin.payouts.sortByDate")}
        </button>
      </div>

      {activeQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("admin.payouts.loading")}</p>
      ) : null}
      {isEmptyForTab ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>
        </div>
      ) : null}
      {!activeQuery.isLoading && activeList.length > 0 && filtered.length === 0 ? (
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("admin.payouts.searchEmpty")}</p>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
          <div
            id={tab === "pending" ? "payouts-pending-panel" : "payouts-completed-panel"}
            role="tabpanel"
            aria-labelledby={tab === "pending" ? "payouts-pending-tab" : "payouts-completed-tab"}
            className="divide-y divide-gray-50"
          >
            {sections
              ? sections.map((section) => (
                  <div key={section.key}>
                    <div className="px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground bg-muted/40">
                      {t(section.labelKey, section.labelArgs)}
                    </div>
                    {section.items.map((p) =>
                      tab === "pending" ? (
                        <PendingPayoutRow
                          key={p.id}
                          p={p}
                          onComplete={() => setCompleteFor(p.id)}
                          onFail={() => setFailFor(p.id)}
                          activeCompleteId={processingId}
                          activeFailId={failProcessingId}
                        />
                      ) : (
                        <CompletedPayoutRow key={p.id} p={p} />
                      ),
                    )}
                  </div>
                ))
              : sorted.map((p) =>
                  tab === "pending" ? (
                    <PendingPayoutRow
                      key={p.id}
                      p={p}
                      onComplete={() => setCompleteFor(p.id)}
                      onFail={() => setFailFor(p.id)}
                      activeCompleteId={processingId}
                      activeFailId={failProcessingId}
                    />
                  ) : (
                    <CompletedPayoutRow key={p.id} p={p} />
                  ),
                )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PendingPayoutRow({
  p,
  onComplete,
  onFail,
  activeCompleteId,
  activeFailId,
}: {
  p: AdminPayout;
  onComplete: () => void;
  onFail: () => void;
  activeCompleteId: string | null;
  activeFailId: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-mono text-muted-foreground">{p.id}</p>
        {/* P1-8 / P3-6: render sellerName if available, otherwise sellerId */}
        <p className="text-sm font-semibold text-foreground">
          {p.sellerName ?? t("admin.payouts.sellerLabel", { id: p.sellerId })}
        </p>
        <p className="text-xs text-muted-foreground">
          {p.requestedAt ? formatDate(p.requestedAt) : ""}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-bold text-base" style={{ color: "var(--accent)" }}>
          {formatPrice(p.amount)}
        </span>
        <button
          onClick={onComplete}
          disabled={activeCompleteId === p.id}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--success)" }}
        >
          {t("admin.payouts.complete")}
        </button>
        <button
          onClick={onFail}
          disabled={activeFailId === p.id}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-500 disabled:opacity-50"
        >
          {t("admin.payouts.fail")}
        </button>
      </div>
    </div>
  );
}

function CompletedPayoutRow({ p }: { p: AdminPayout }) {
  const { t } = useTranslation();
  // Older COMPLETED rows that predate the V5 migration have no captured
  // admin id. Render the unknown-admin variant rather than an empty span
  // so an admin reviewing history can tell missing data from a fresh row.
  const completedLabel = p.completedBy
    ? t("admin.payouts.completedBy", { id: p.completedBy })
    : t("admin.payouts.completedByUnknown");
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-mono text-muted-foreground">{p.id}</p>
        {/* P1-8 / P3-6: render sellerName if available, otherwise sellerId */}
        <p className="text-sm font-semibold text-foreground">
          {p.sellerName ?? t("admin.payouts.sellerLabel", { id: p.sellerId })}
        </p>
        <p className="text-xs text-muted-foreground">
          {p.completedAt
            ? formatDate(p.completedAt)
            : p.requestedAt
              ? formatDate(p.requestedAt)
              : ""}
        </p>
        <p className="text-xs text-emerald-600 font-medium mt-0.5">{completedLabel}</p>
      </div>
      {/* P2-8: settled/passed amount — positive tone, no line-through */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-bold text-base text-emerald-600">{formatPrice(p.amount)}</span>
      </div>
    </div>
  );
}
