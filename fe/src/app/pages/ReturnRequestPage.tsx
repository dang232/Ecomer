import { ArrowLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { useOrder } from "../hooks/use-orders";
import { ApiError } from "@/shared/api";
import { requestReturn } from "@/shared/api/endpoints/returns";
import { PageContainer, PageHeader } from "@/shared/ui";
import { AccountNav } from "@/features/account";
import { ReturnWorkflow } from "@/features/returns";

interface ReturnRequestPageProps {
  initialSubOrderId?: string;
}

export function ReturnRequestPage({ initialSubOrderId }: ReturnRequestPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId") ?? undefined;
  const preselectedSubOrderId =
    initialSubOrderId ?? searchParams.get("subOrderId") ?? undefined;
  const orderQuery = useOrder(orderId);

  const submitReturn = useMutation({
    mutationFn: (input: { subOrderId: string; reason: string; pickupType: "pickup" | "dropoff" }) =>
      requestReturn({
        subOrderId: input.subOrderId,
        reason: input.reason,
        pickupType: input.pickupType,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["returns"] });
      toast.success(t("return.request.success"));
      void navigate("/returns");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : t("return.request.error");
      toast.error(message);
    },
  });

  return (
    <PageContainer className="max-w-3xl py-8">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/returns"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("return.request.backToOrders")}
        >
          <ArrowLeft size={18} />
        </Link>
        <PageHeader
          title={t("return.request.title")}
          description={t("return.request.subtitle", {
            defaultValue: "Review the package, choose the affected item when available, and explain the issue clearly.",
          })}
        />
      </div>

      <AccountNav />

      <ReturnWorkflow
        order={orderQuery.data ?? null}
        initialSubOrderId={preselectedSubOrderId}
        pending={submitReturn.isPending}
        onSubmit={(input) =>
          submitReturn.mutate({
            subOrderId: input.subOrderId,
            reason: input.reason,
            pickupType: input.pickupType,
          })
        }
      />
    </PageContainer>
  );
}

export function ReturnRequestPageWrapper() {
  return <ReturnRequestPage />;
}

export default ReturnRequestPageWrapper;
