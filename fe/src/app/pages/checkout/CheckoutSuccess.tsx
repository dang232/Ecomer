import { CheckCircle } from "lucide-react";
import { motion } from "motion/react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { formatPrice } from "@/shared/lib";

import type { PaymentOption } from "./types";

interface Props {
  placedOrderId: string | null;
  selectedPaymentId: PaymentOption["id"];
  finalTotal: number;
}

const CONFETTI_PIECES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  color: ["bg-primary", "bg-success", "bg-yellow-400", "bg-pink-400", "bg-blue-400"][i % 5],
  left: `${(i * 5.5 + 2) % 100}%`,
  delay: `${(i * 0.09) % 1}s`,
  duration: `${1.2 + (i % 4) * 0.2}s`,
}));

export function CheckoutSuccess({ placedOrderId, selectedPaymentId, finalTotal }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="max-w-[500px] mx-auto py-16 px-6 text-center relative overflow-hidden">
      {/* Confetti */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden"
        aria-hidden
      >
        {CONFETTI_PIECES.map((p) => (
          <span
            key={p.id}
            className={["absolute top-0 w-2 h-2 rounded-sm opacity-0", p.color].join(" ")}
            style={{
              left: p.left,
              animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes confettiFall {
          0%  { transform: translateY(-10px) rotate(0deg);   opacity: 1; }
          80% { opacity: 1; }
          100%{ transform: translateY(160px) rotate(360deg); opacity: 0; }
        }
        @keyframes bounceIn {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          80%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.6 }}
      >
        {/* Success icon */}
        <div
          className="w-20 h-20 rounded-full bg-[var(--success-light,oklch(0.95_0.05_145))] flex items-center justify-center mx-auto mb-6"
          style={{ animation: "bounceIn 0.7s ease both" }}
        >
          <CheckCircle size={40} className="text-success" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">
          {["STRIPE", "PAYPAL", "VIETQR"].includes(selectedPaymentId)
            ? t("checkout.success.gatewayTitle")
            : t("checkout.success.title")}
        </h1>

        {placedOrderId ? (
          <>
            <p className="text-muted-foreground text-sm mb-2">
              {t("checkout.success.orderIdLabel")}
            </p>
            <code className="inline-block px-5 py-2.5 rounded-[var(--radius-lg)] mb-6 font-mono font-semibold text-base bg-surface-elevated text-primary">
              {placedOrderId}
            </code>
          </>
        ) : null}

        {selectedPaymentId === "COD" ? (
          <p className="text-sm text-muted-foreground mb-4">
            <Trans
              i18nKey="checkout.success.codNotice"
              values={{ amount: formatPrice(finalTotal) }}
              components={{ 1: <strong /> }}
            />
          </p>
        ) : null}

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => navigate(placedOrderId ? `/orders/${placedOrderId}` : "/orders")}
            className="flex-1 py-3 rounded-[var(--radius-lg)] bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            {t("checkout.success.viewOrders")}
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex-1 py-3 rounded-[var(--radius-lg)] border border-border text-foreground font-semibold text-sm hover:bg-card transition-colors"
          >
            {t("checkout.success.continueShopping")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
