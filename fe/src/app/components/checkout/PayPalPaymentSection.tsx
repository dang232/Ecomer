import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { useState } from "react";
import { toast } from "sonner";

import { paypalCapture, paypalCreate } from "@/shared/api/endpoints/payment";

interface Props {
  orderId: string;
  idempotencyKey: string;
  initialization?: {
    paymentId: string;
    clientId: string;
    paypalOrderId: string;
  };
  onCompleted: () => void;
}

export function PayPalPaymentSection({
  orderId,
  idempotencyKey,
  initialization,
  onCompleted,
}: Props) {
  // ponytail: read env at render time so stubEnv() in tests works and HMR picks up changes
  const paypalEnabled = import.meta.env.VITE_PAYPAL_ENABLED === "true";
  const clientId = initialization?.clientId ?? import.meta.env.VITE_PAYPAL_CLIENT_ID ?? "";

  const [paymentId, setPaymentId] = useState<string | null>(initialization?.paymentId ?? null);
  const [error, setError] = useState<string | null>(null);

  if ((!paypalEnabled && !initialization) || !clientId) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
        PayPal is disabled. Set <code>VITE_PAYPAL_ENABLED=true</code> and{" "}
        <code>VITE_PAYPAL_CLIENT_ID</code> to enable.
      </div>
    );
  }

  return (
    <div data-testid="paypal-section">
      <PayPalScriptProvider options={{ clientId, currency: "USD" }}>
        <PayPalButtons
          createOrder={async () => {
            if (initialization) return initialization.paypalOrderId;
            const res = await paypalCreate({ orderId }, idempotencyKey);
            if (!res.payment.paymentId) {
              throw new Error("missing payment id");
            }
            setPaymentId(res.payment.paymentId);
            return res.paypalOrderId;
          }}
          onApprove={async (data) => {
            const paypalOrderId = typeof data.orderID === "string" ? data.orderID : "";
            if (!paymentId) {
              setError("missing payment id");
              return;
            }
            if (!paypalOrderId) {
              setError("missing PayPal order id");
              return;
            }
            if (initialization && paypalOrderId !== initialization.paypalOrderId) {
              setError("unexpected PayPal order id");
              return;
            }
            try {
              await paypalCapture(paymentId, paypalOrderId);
              onCompleted();
            } catch (err) {
              const msg = err instanceof Error ? err.message : "capture failed";
              setError(msg);
              toast.error(msg);
            }
          }}
          onError={(err) => {
            const msg = err instanceof Error ? err.message : "PayPal error";
            setError(msg);
            toast.error(msg);
          }}
        />
      </PayPalScriptProvider>
      {error ? (
        <div className="mt-3 rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
