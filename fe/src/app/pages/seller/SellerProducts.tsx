import { useAuth } from "../../hooks/auth-context";
import { SellerProductsListRoute } from "@/features/seller-products";

export function SellerProducts() {
  const { subject: sellerId } = useAuth();

  return <SellerProductsListRoute sellerId={sellerId} />;
}
