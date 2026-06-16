import { useSearchParams } from "react-router";

const TABS = [
  { label: "Tất cả", value: "" },
  { label: "Đơn hàng", value: "ORDER_CREATED,ORDER_CANCELLED,ORDER_SHIPPED,ORDER_DELIVERED,SELLER_NEW_ORDER" },
  { label: "Thanh toán", value: "PAYMENT_COMPLETED,PAYMENT_REFUNDED,PAYOUT_COMPLETED" },
  { label: "Vận chuyển", value: "ORDER_SHIPPED" },
  { label: "Đánh giá", value: "REVIEW_REPLIED" },
  { label: "Người bán", value: "PRODUCT_APPROVED,PRODUCT_REJECTED,RETURN_REQUESTED" },
] as const;

export function NotificationFilters() {
  const [params, setParams] = useSearchParams();
  const current = params.get("type") ?? "";

  const select = (value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set("type", value);
      else next.delete("type");
      next.set("page", "0");
      return next;
    });
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {TABS.map((tab) => (
        <button
          key={tab.label}
          onClick={() => select(tab.value)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            current === tab.value
              ? "bg-[var(--primary)] text-white"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
