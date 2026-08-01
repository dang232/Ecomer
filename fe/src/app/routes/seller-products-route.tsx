/**
 * SellerProductsRoute — Plan 07 direct-route adapter.
 * Bridges the `/seller/products` route to the feature component.
 * Uses `useAuth().subject` as the seller ID (same as legacy SellerProducts wrapper).
 */

import { useAuth } from "@/app/hooks/auth-context";
import { SellerProductsListRoute } from "@/features/seller-products";

export function SellerProductsRoute() {
  const { subject: sellerId } = useAuth();
  return <SellerProductsListRoute sellerId={sellerId} />;
}
