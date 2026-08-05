import type { SellerRevenuePoint } from "@/shared/api/endpoints/seller-analytics";

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

export interface RevenueChartPoint {
  day: string;
  revenue: number;
  orders: number;
}

export function toRevenueChartData(points: SellerRevenuePoint[]): RevenueChartPoint[] {
  return points.map((p) => ({
    day: WEEKDAY_LABELS[new Date(`${p.date}T00:00:00`).getDay()] ?? p.date,
    revenue: Number(p.revenue) || 0,
    orders: p.orderCount,
  }));
}
