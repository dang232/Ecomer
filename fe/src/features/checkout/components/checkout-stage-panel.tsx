import { motion } from "motion/react";
import type { ReactNode } from "react";

type CheckoutStage = "address" | "shipping" | "payment" | "review";

interface CheckoutStagePanelProps {
  step: CheckoutStage;
  children: ReactNode;
}

export function CheckoutStagePanel({ step, children }: CheckoutStagePanelProps) {
  return (
    <motion.section
      key={step}
      id={`step-${step}`}
      aria-labelledby={`checkout-${step}-heading`}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
      className="rounded-[var(--radius-card)] border border-border bg-card p-4 sm:p-6"
    >
      {children}
    </motion.section>
  );
}
