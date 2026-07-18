import { IconCircleCheck, IconAlertCircle, IconClock } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { ApiError } from "../lib/api";
import { paymentStatus } from "../lib/api/endpoints/payment";
import { formatPrice } from "../lib/format";

type Provider = "vnpay" | "momo";
type Phase = "pending" | "completed" | "failed" | "error";

const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "PAID",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
]);

export function PaymentReturnPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ provider: string }>();
  const [search] = useSearchParams();

  const provider: Provider = params.provider === "momo" ? "momo" : "vnpay";

  // Most VN gateways return order id in their own param names. Try a few common ones.
  const orderId = useMemo(() => {
    const candidates = [
      search.get("orderId"),
      search.get("vnp_TxnRef"),
      search.get("orderInfo"),
      search.get("requestId"),
    ];
    return candidates.find((v): v is string => !!v) ?? null;
  }, [search]);

  const [phase, setPhase] = useState<Phase>("pending");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [amount, setAmount] = useState<number | null>(null);
  const [, setAttempts] = useState(0);
  // Mirror of `attempts` for use inside the polling closure. We keep both:
  // state drives a re-render if anything ever needs to read the count, and the
  // ref gives the poll callback a stable, up-to-date read without re-running
  // the effect on every increment.
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!orderId) {
      setPhase("error");
      setErrorMessage(t("paymentReturn.error.noOrderId"));
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    attemptsRef.current = 0;
    setAttempts(0);

    const bumpAttempts = () => {
      setAttempts((n) => {
        const next = n + 1;
        attemptsRef.current = next;
        return next;
      });
    };

    const poll = async () => {
      try {
        const status = await paymentStatus(orderId);
        if (cancelled) return;
        if (TERMINAL_STATUSES.has(status.status.toUpperCase())) {
          const ok = ["COMPLETED", "PAID", "SUCCESS"].includes(status.status.toUpperCase());
          setPhase(ok ? "completed" : "failed");
          return;
        }
        // Not terminal yet: backoff and retry up to ~30 attempts (~60s).
        bumpAttempts();
        timeout = setTimeout(() => void poll(), attemptsRef.current < 5 ? 1000 : 2000);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status >= 500 && attemptsRef.current < 10) {
            bumpAttempts();
            timeout = setTimeout(() => void poll(), 2000);
            return;
          }
          setPhase("error");
          setErrorMessage(err.message);
          return;
        }
        setPhase("error");
        setErrorMessage(t("paymentReturn.error.checkFailed"));
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [orderId, t]);

  // Best-effort amount surface: gateways sometimes pass it back in URL.
  useEffect(() => {
    const raw = search.get("vnp_Amount") ?? search.get("amount");
    if (raw) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) {
        // VNPay returns amount * 100; MoMo returns plain VND.
        setAmount(provider === "vnpay" ? parsed / 100 : parsed);
      }
    }
  }, [provider, search]);

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      {phase === "pending" ? (
        <>
          <div
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse"
            style={{ background: "rgba(0,191,179,0.12)" }}
          >
            <IconClock size={36} style={{ color: "var(--primary)" }} />
          </div>
          <h1
            className="text-2xl font-bold text-foreground mb-3"
            style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
          >
            {t("paymentReturn.pending.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("paymentReturn.pending.body", { provider: provider === "vnpay" ? "VNPay" : "MoMo" })}
          </p>
        </>
      ) : null}

      {phase === "completed" ? (
        <>
          <div
            className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: "rgb(var(--success-rgb) / 0.12)" }}
          >
            <IconCircleCheck size={48} style={{ color: "var(--success)" }} />
          </div>
          <h1
            className="text-3xl font-black text-foreground mb-3"
            style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}
          >
            {t("paymentReturn.completed.title")}
          </h1>
          {amount !== null ? (
            <p className="text-sm text-muted-foreground mb-2">
              {t("paymentReturn.completed.amountPaid")} <strong>{formatPrice(amount)}</strong>
            </p>
          ) : null}
          {orderId ? (
            <p className="text-sm text-muted-foreground mb-8">
              {t("paymentReturn.completed.orderIdLabel")}{" "}
              <span className="font-mono font-semibold">{orderId}</span>
            </p>
          ) : null}
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/orders")}
              className="flex-1 py-3 rounded-xl border-2 font-semibold text-sm"
              style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
            >
              {t("paymentReturn.completed.viewOrders")}
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex-1 py-3 rounded-xl text-white font-semibold text-sm"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-deep))" }}
            >
              {t("paymentReturn.completed.continueShopping")}
            </button>
          </div>
        </>
      ) : null}

      {phase === "failed" ? (
        <>
          <div
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: "rgb(var(--error-rgb) / 0.12)" }}
          >
            <IconAlertCircle size={40} style={{ color: "var(--error)" }} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            {t("paymentReturn.failed.title")}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{t("paymentReturn.failed.body")}</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/orders")}
              className="flex-1 py-3 rounded-xl text-white font-semibold text-sm"
              style={{ background: "var(--primary)" }}
            >
              {t("paymentReturn.failed.goOrders")}
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-semibold text-sm"
            >
              {t("paymentReturn.failed.goHome")}
            </button>
          </div>
        </>
      ) : null}

      {phase === "error" ? (
        <>
          <div
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: "rgb(var(--warning-rgb) / 0.12)" }}
          >
            <IconAlertCircle size={40} style={{ color: "var(--warning)" }} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            {t("paymentReturn.error.title")}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {errorMessage || t("paymentReturn.error.fallback")}
          </p>
          <button
            onClick={() => navigate("/orders")}
            className="px-6 py-3 rounded-xl text-white font-semibold text-sm"
            style={{ background: "var(--primary)" }}
          >
            {t("paymentReturn.error.goOrders")}
          </button>
        </>
      ) : null}
    </div>
  );
}
