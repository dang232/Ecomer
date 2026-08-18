import type { ParcelDimensions } from "@/shared/contracts/api/product";

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
  categoryId?: string;
  categoryLabel: string;
  brand?: string;
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
    parcel?: ParcelDimensions | null;
  }[];
  shipping: string;
  shippingFee: number;
  location: string;
  tags: string[];
  sameDayDelivery?: boolean;
  verified?: boolean;
  isOfficial?: boolean;
}
