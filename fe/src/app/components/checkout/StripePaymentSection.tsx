import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { paymentStatus, stripeCreate } from "../../lib/api/endpoints/payment";

interface Props {
  orderId: string;
  idempotencyKey: string;
  initialization?: {
    clientSecret: string;
    publishableKey: string;
  };
  onCompleted: () => void;
}

export function StripePaymentSection({ orderId, idempotencyKey, initialization, onCompleted }: Props) {
  // ponytail: read env at render time so stubEnv() in tests works and HMR picks up changes
  const stripeEnabled = import.meta.env.VITE_STRIPE_ENABLED === "true";
  const publishableKey = initialization?.publishableKey ?? import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";

  const { t } = useTranslation();
  const [clientSecret, setClientSecret] = useState<string | null>(initialization?.clientSecret ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ponytail: lazy promise so it picks up env changes too
  const stripePromise: Promise<Stripe | null> | null = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  useEffect(() => {
    if ((!stripeEnabled && !initialization) || !stripePromise) return;
    if (clientSecret || loading) return;
    setLoading(true);
    stripeCreate({ orderId }, idempotencyKey)
      .then((res) => {
        setClientSecret(res.clientSecret);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId, idempotencyKey, clientSecret, initialization, loading, stripeEnabled, stripePromise]);

  const options = useMemo(
    () => (clientSecret ? { clientSecret, appearance: { theme: "stripe" as const } } : undefined),
    [clientSecret],
  );

  if (!stripeEnabled && !initialization) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
        Stripe is disabled. Set <code>VITE_STRIPE_ENABLED=true</code> and{" "}
        <code>VITE_STRIPE_PUBLISHABLE_KEY</code> to enable.
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!clientSecret || !stripePromise || !options) {
    return (
      <div
        className="rounded-2xl border-2 border-border p-4 text-sm text-muted-foreground"
        data-testid="stripe-loading"
      >
        {t("stripe.initializing")}
      </div>
    );
  }

  return (
    <div data-testid="stripe-section">
      <Elements stripe={stripePromise} options={options}>
        <StripeForm orderId={orderId} onCompleted={onCompleted} />
      </Elements>
    </div>
  );
}

function StripeForm({ orderId, onCompleted }: { orderId: string; onCompleted: () => void }) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/checkout` },
      redirect: "if_required",
    });
    setSubmitting(false);
    if (confirmError) {
      toast.error(confirmError.message ?? t("checkout.payment.placeOrderFailed"));
      return;
    }
    // Stripe confirmed client-side — poll for the webhook to land.
    setPolling(true);
    const deadline = Date.now() + 5 * 60_000;
    const tick = async () => {
      if (Date.now() > deadline) {
        setPolling(false);
        toast.message(t("stripe.processingEmail"));
        return;
      }
      try {
        const status = await paymentStatus(orderId);
        if (status.status === "COMPLETED") {
          setPolling(false);
          onCompleted();
          return;
        }
      } catch {
        // ignore transient failures
      }
      window.setTimeout(() => {
        void tick();
      }, 2000);
    };
    void tick();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || submitting || polling}
        className="w-full px-6 py-3 rounded-xl text-white font-semibold disabled:opacity-50"
        style={{ background: "var(--primary)" }}
        data-testid="stripe-submit"
      >
        {polling ? t("stripe.confirming") : submitting ? t("stripe.processing") : t("stripe.pay")}
      </button>
    </form>
  );
}
