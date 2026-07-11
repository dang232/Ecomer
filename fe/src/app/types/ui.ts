/**
 * UI-side shapes that diverge from the BE schemas in `types/api/`.
 *
 * `Product` is wider than `ProductSummary`/`ProductDetail` because the UI
 * renders fields the API does not expose (categoryLabel, shipping copy,
 * location). `useProducts.fromServer` maps the BE shape into this one.
 *
 * `UIOrder` is the flattened render shape used by `OrdersPage`; the BE
 * `Order` lives in `types/api/order.ts` and is mapped to `UIOrder` at the
 * page boundary.
 */

export interface Product {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  image: string;
  images: string[];
  category: string;
  categoryLabel: string;
  sellerId: string;
  sellerName: string;
  rating: number;
  reviewCount: number;
  sold: number;
  stock: number;
  description: string;
  badge?: "flash" | "new" | "bestseller" | "hot";
  colors?: string[];
  sizes?: string[];
  variants?: {
    sku?: string;
    name?: string;
    priceAmount?: number;
    priceCurrency?: string;
    imageUrl?: string;
    stockQuantity?: number;
  }[];
  shipping: string;
  shippingFee: number;
  location: string;
  tags: string[];
}

export interface UIOrder {
  id: string;
  date: string;
  status: "pending" | "confirmed" | "shipping" | "delivered" | "cancelled" | "returned";
  items: {
    productId: string;
    name: string;
    image: string;
    quantity: number;
    price: number;
    variant?: string;
  }[];
  /** Item count from the list-endpoint projection. Use this when `items` is
   * empty (list view doesn't carry the line items, only the detail endpoint
   * does) so the UI can render "X products" instead of a permanent loading
   * spinner. */
  itemCount?: number;
  total: number;
  shipping: number;
  discount: number;
  address: string;
  trackingCode?: string;
  carrier?: string;
  seller: string;
  paymentMethod: string;
  estimatedDelivery?: string;
}
