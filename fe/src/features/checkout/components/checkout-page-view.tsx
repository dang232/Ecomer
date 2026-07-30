import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/shared/ui";

type CheckoutStage = "address" | "shipping" | "payment" | "review";

interface CheckoutPageViewProps {
  step: CheckoutStage;
  onBack: () => void;
  stepper: ReactNode;
  stage: ReactNode;
  summary: ReactNode;
}

export function CheckoutPageView({
  step: _step,
  onBack,
  stepper,
  stage,
  summary,
}: CheckoutPageViewProps) {
  const { t } = useTranslation();

  return (
    <PageContainer className="pb-24 sm:pb-8">
      <header className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("common.back")}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-2xl font-bold text-foreground">{t("checkout.title")}</h1>
      </header>
      {stepper}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div>{stage}</div>
        <aside className="self-start lg:sticky lg:top-32">{summary}</aside>
      </div>
    </PageContainer>
  );
}
