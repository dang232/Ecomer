import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { useAuth } from "../hooks/auth-context";
import { useCart } from "../hooks/use-cart";
import { useCancelOrder, useOrder } from "../hooks/use-orders";
import { ApiError } from "@/shared/api";
import { PageContainer, PageHeader } from "@/shared/ui";
import { OrderDetail, toOrderView, type OrderView } from "@/features/orders";
import type { Order } from "@/shared/contracts/api";

function findSummaryInCache(queryClient: ReturnType<typeof useQueryClient>, id: string): Order | undefined {
  const cached = queryClient.getQueriesData<{ content?: Order[] }>({
    queryKey: ["orders"],
  });

  for (const [queryKey, value] of cached) {
    if (Array.isArray(queryKey) && queryKey[1] === "detail") continue;
    const match = value?.content?.find((order) => order.id === id);
    if (match) return match;
  }

  return undefined;
}

export function OrderDetailPage() {
  const { ready, authenticated, login } = useAuth();
  const { id } = useParams();
  const { addItemAsync } = useCart();
  const cancelOrder = useCancelOrder();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const orderQuery = useOrder(id);

  const summary = useMemo(() => {
    if (!id) return undefined;
    return findSummaryInCache(queryClient, id);
  }, [id, queryClient]);

  const view = useMemo(() => {
    if (!orderQuery.data) return null;
    return toOrderView({
      detail: orderQuery.data,
      summary,
    });
  }, [orderQuery.data, summary]);

  const handleBuyAgain = useCallback(
    async (order: OrderView) => {
      try {
        for (const item of order.sellerGroups.flatMap((group) => group.items)) {
          await addItemAsync({ productId: item.productId, quantity: item.quantity });
        }
        toast.success(t("orders.reorder.added", { count: order.sellerGroups.length }));
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : t("orders.reorder.addError"));
      }
    },
    [addItemAsync, t],
  );

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">
        {t("orders.loading")}
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h2 className="text-xl font-bold text-foreground">{t("orders.loginPromptTitle")}</h2>
        <button
          type="button"
          onClick={() => login(`/orders/${id ?? ""}`)}
          className="mt-4 rounded-[var(--radius-md)] bg-primary px-6 py-3 font-semibold text-white"
        >
          {t("auth.login")}
        </button>
      </div>
    );
  }

  if (orderQuery.isError) {
    const message =
      orderQuery.error instanceof ApiError ? orderQuery.error.message : t("orders.detail.loadError");
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <Package size={48} className="mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-sm text-error">{message}</p>
      </div>
    );
  }

  if (orderQuery.isLoading || !view) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">
        {t("orders.loading")}
      </div>
    );
  }

  return (
    <PageContainer className="pb-8">
      <button
        type="button"
        onClick={() => navigate("/orders")}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} />
        {t("orders.detail.back")}
      </button>
      <PageHeader
        title={t("orders.detail.title")}
        description={t("orders.detail.description")}
        className="mb-6"
      />
      <OrderDetail
        order={view}
        onCancel={(order) =>
          cancelOrder.mutate(order.id, {
            onSuccess: () => toast.success(t("orders.cancelOk")),
            onError: (error) =>
              toast.error(error instanceof ApiError ? error.message : t("orders.cancelErr")),
          })
        }
        onBuyAgain={(order) => void handleBuyAgain(order)}
      />
    </PageContainer>
  );
}

export default OrderDetailPage;
