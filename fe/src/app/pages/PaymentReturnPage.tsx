import { IconAlertCircle, IconCircleCheck, IconClock } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { z } from "zod";

import { createCheckoutRecoveryStore, type CheckoutRecoveryStore } from "../../features/checkout";
import { ApiError } from "@/shared/api";
import { paymentStatus } from "@/shared/api/endpoints/payment";
import { formatPrice } from "@/shared/lib";

const providerSchema = z.enum(["vnpay", "momo"]);
type Phase = "pending" | "completed" | "failed" | "error";
const MAX_PENDING_ATTEMPTS = 30;

export function PaymentReturnPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ provider: string }>();
  const [search] = useSearchParams();
  const recoveryStoreRef = useRef<CheckoutRecoveryStore | null>(null);
  if (!recoveryStoreRef.current) {
    recoveryStoreRef.current = createCheckoutRecoveryStore(sessionStorage);
  }
  const recoveryStore = recoveryStoreRef.current;
  const providerResult = providerSchema.safeParse(params.provider);
  const provider = providerResult.success ? providerResult.data : null;
  const recovery = useMemo(() => recoveryStore.read(), [recoveryStore]);
  const redirectRecovery = recovery?.phase === "redirect" ? recovery : null;
  const gatewayReference = useMemo(() => {
    if (provider === "vnpay") return search.get("vnp_TxnRef");
    if (provider === "momo") return search.get("orderId") ?? search.get("requestId");
    return null;
  }, [provider, search]);
  const validationError = useMemo(() => {
    if (!provider) return t("paymentReturn.error.invalidProvider");
    if (!redirectRecovery) return t("paymentReturn.error.invalidRecovery");
    if (redirectRecovery.provider !== provider.toUpperCase())
      return t("paymentReturn.error.mismatchedRecovery");
    if (gatewayReference && gatewayReference !== redirectRecovery.paymentId) {
      return t("paymentReturn.error.mismatchedRecovery");
    }
    return null;
  }, [gatewayReference, provider, redirectRecovery, t]);
  const orderId = validationError ? null : (redirectRecovery?.orderId ?? null);

  const [phase, setPhase] = useState<Phase>(validationError ? "error" : "pending");
  const [errorMessage, setErrorMessage] = useState(validationError ?? "");

  useEffect(() => {
    if (validationError || !orderId) {
      setPhase("error");
      setErrorMessage(validationError ?? t("paymentReturn.error.invalidRecovery"));
      return;
    }

    let cancelled = false;
    let timeout: number | undefined;
    let attempts = 0;

    const finish = (next: Extract<Phase, "completed" | "failed">) => {
      recoveryStore.clear();
      setPhase(next);
    };
    const retry = (delay: number) => {
      attempts += 1;
      if (attempts >= MAX_PENDING_ATTEMPTS) {
        setPhase("error");
        setErrorMessage(t("paymentReturn.error.pendingTooLong"));
        return;
      }
      timeout = window.setTimeout(() => void poll(), delay);
    };
    const poll = async (): Promise<void> => {
      try {
        const status = await paymentStatus(orderId);
        if (cancelled) return;
        if (status.status === "COMPLETED") {
          finish("completed");
          return;
        }
        if (status.status === "FAILED" || status.status === "PAYMENT_TIMEOUT") {
          finish("failed");
          return;
        }
        if (status.status === "PENDING") {
          retry(attempts < 5 ? 1000 : 2000);
          return;
        }
        setPhase("error");
        setErrorMessage(t("paymentReturn.error.checkFailed"));
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status >= 500 && attempts < 10) {
          retry(2000);
          return;
        }
        setPhase("error");
        setErrorMessage(
          error instanceof ApiError ? error.message : t("paymentReturn.error.checkFailed"),
        );
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [orderId, recoveryStore, t, validationError]);

  const amount = orderId ? (redirectRecovery?.total ?? null) : null;

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
              style={{ background: "var(--primary)" }}
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
