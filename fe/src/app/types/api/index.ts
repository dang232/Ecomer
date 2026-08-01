/**
 * Barrel for the FE zod schema layer. Re-exports every domain module so
 * existing callers `import { ... } from "../../../types/api"` keep working
 * after the file → folder split.
 */

export * from "./branded-ids";
export * from "./shared";
export * from "./product";
export * from "./category";
export * from "./user";
export * from "./cart";
export * from "./order";
export * from "./review";
export * from "./notification";
export * from "./checkout";
export * from "./coupon";
export * from "./payment";
export * from "./flash-sale";
export * from "./wishlist";
export * from "./shipping";
export * from "./search";
export * from "./seller-analytics";
export * from "./seller-finance";
export * from "./admin";
export * from "./seller";
