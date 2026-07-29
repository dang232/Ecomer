import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { CheckoutRecoveryRecord, CheckoutSubmissionState } from "../../../features/checkout";
import { PayPalPaymentSection } from "../../components/checkout/PayPalPaymentSection";
import { StripePaymentSection } from "../../components/checkout/StripePaymentSection";
import { VietQrPaymentSection } from "../../components/checkout/VietQrPaymentSection";

interface Props {
  recovery: CheckoutRecoveryRecord | null;
  submission: CheckoutSubmissionState;
  onResume: () => Promise<void>;
  onViewOrder: (orderId?: string) => void;
  onContinueRedirect: (url: string) => void;
  onPaymentCompleted: () => void;
}

export function CheckoutPaymentRecovery({
  recovery,
  submission,
  onResume,
  onViewOrder,
  onContinueRedirect,
  onPaymentCompleted,
}: Props) {
  const { t } = useTranslation();
  const [ordersOpened, setOrdersOpened] = useState(false);

  if (submission.status === "reconciling" || recovery?.phase === "order") {
    return (
      <RecoveryPanel
        title={t("checkout.payment.recovery.checkingTitle")}
        body={t("checkout.payment.recovery.checkingBody")}
      />
    );
  }

  if (submission.status === "uncertain") {
    return (
      <RecoveryPanel
        title={t("checkout.payment.recovery.uncertainTitle")}
        body={t("checkout.payment.recovery.uncertainBody")}
      >
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
          onClick={() => {
            setOrdersOpened(true);
            onViewOrder();
          }}
        >
          {t("checkout.payment.recovery.viewOrders")}
        </button>
        {ordersOpened ? (
          <p className="text-sm text-muted-foreground">
            {t("checkout.payment.recovery.abandonHint")}
          </p>
        ) : null}
      </RecoveryPanel>
    );
  }

  if (submission.status === "failed" || recovery?.phase === "created") {
    const orderId = submission.status === "failed" ? submission.orderId : recovery?.orderId;
    return (
      <RecoveryPanel
        title={t("checkout.payment.recovery.paymentFailedTitle")}
        body={t("checkout.payment.recovery.paymentFailedBody", { id: orderId ?? "" })}
      >
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
          onClick={() => void onResume()}
        >
          {t("checkout.payment.recovery.retryPayment")}
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-lg border border-border text-sm font-semibold"
          onClick={() => onViewOrder(orderId)}
        >
          {t("checkout.payment.recovery.viewOrder")}
        </button>
      </RecoveryPanel>
    );
  }

  if (submission.status === "pending" && submission.providerState.kind === "redirect") {
    const redirectUrl = submission.providerState.redirectUrl;
    return (
      <RecoveryPanel
        title={t("checkout.payment.recovery.continueTitle")}
        body={t("checkout.payment.recovery.continueBody")}
      >
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
          onClick={() => onContinueRedirect(redirectUrl)}
        >
          {t("checkout.payment.recovery.continuePayment")}
        </button>
      </RecoveryPanel>
    );
  }

  if (recovery?.phase === "redirect") {
    return (
      <RecoveryPanel
        title={t("checkout.payment.recovery.continueTitle")}
        body={t("checkout.payment.recovery.redirectExpiredBody")}
      >
        <button
          type="button"
          className="px-4 py-2 rounded-lg border border-border text-sm font-semibold"
          onClick={() => onViewOrder(recovery.orderId)}
        >
          {t("checkout.payment.recovery.viewOrder")}
        </button>
      </RecoveryPanel>
    );
  }

  if (submission.status === "pending" && submission.providerState.kind === "vietqr") {
    return (
      <VietQrPaymentSection
        orderId={submission.orderId}
        idempotencyKey={submission.paymentKey}
        initialization={submission.providerState}
        onCompleted={onPaymentCompleted}
      />
    );
  }
  if (recovery?.phase === "vietqr") {
    return (
      <VietQrPaymentSection
        orderId={recovery.orderId}
        idempotencyKey={recovery.paymentKey}
        initialization={recovery}
        onCompleted={onPaymentCompleted}
      />
    );
  }

  if (submission.status === "pending" && submission.providerState.kind === "stripe") {
    return (
      <StripePaymentSection
        orderId={submission.orderId}
        idempotencyKey={submission.paymentKey}
        initialization={submission.providerState}
        onCompleted={onPaymentCompleted}
      />
    );
  }
  if (recovery?.phase === "stripe") {
    return (
      <StripePaymentSection
        orderId={recovery.orderId}
        idempotencyKey={recovery.paymentKey}
        onCompleted={onPaymentCompleted}
      />
    );
  }

  if (submission.status === "pending" && submission.providerState.kind === "paypal") {
    return (
      <PayPalPaymentSection
        orderId={submission.orderId}
        idempotencyKey={submission.paymentKey}
        initialization={{ paymentId: submission.paymentId, ...submission.providerState }}
        onCompleted={onPaymentCompleted}
      />
    );
  }
  if (recovery?.phase === "paypal") {
    return (
      <PayPalPaymentSection
        orderId={recovery.orderId}
        idempotencyKey={recovery.paymentKey}
        initialization={recovery}
        onCompleted={onPaymentCompleted}
      />
    );
  }

  return null;
}

function RecoveryPanel({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section className="max-w-2xl mx-auto px-4 py-16" aria-live="polite">
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {children ? <div className="mt-5 flex flex-wrap items-center gap-3">{children}</div> : null}
    </section>
  );
}
