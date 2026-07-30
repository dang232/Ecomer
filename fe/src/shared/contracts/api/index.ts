/**
 * Barrel for the FE zod schema layer. Re-exports every domain module so
 * existing callers `import { ... } from "../../../types/api"` keep working
 * after the file → folder split.
 */

export * from "@/shared/contracts/api/branded-ids";
export * from "@/shared/contracts/api/shared";
export * from "@/shared/contracts/api/product";
export * from "@/shared/contracts/api/category";
export * from "@/shared/contracts/api/user";
export * from "@/shared/contracts/api/cart";
export * from "@/shared/contracts/api/order";
export * from "@/shared/contracts/api/review";
export * from "@/shared/contracts/api/notification";
export * from "@/shared/contracts/api/checkout";
export * from "@/shared/contracts/api/coupon";
export * from "@/shared/contracts/api/payment";
export * from "@/shared/contracts/api/flash-sale";
export * from "@/shared/contracts/api/wishlist";
export * from "@/shared/contracts/api/shipping";
export * from "@/shared/contracts/api/search";
export * from "@/shared/contracts/api/seller-analytics";
export * from "@/shared/contracts/api/seller-finance";
export * from "@/shared/contracts/api/admin";
export * from "@/shared/contracts/api/seller";
