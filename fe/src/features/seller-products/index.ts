/**
 * Public interface for the seller-products feature.
 *
 * Page consumers import from here. Plan 07 removes the seller-product-modal.tsx
 * compatibility re-export once all callers have migrated.
 */

export { ProductEditorDrawer } from "./components/product-editor-drawer";
export type { ProductEditorDrawerProps } from "./components/product-editor-drawer";
export { ProductList } from "./components/product-list";
export type { ProductListProps, SellerProductsRouteState } from "./components/product-list";
export { SellerProductsListRoute } from "./components/product-list";
export { sellerProductFormSchema, toSellerProductWriteBody } from "./model/product-form";
export type { SellerProductForm } from "./model/product-form";
export { draftRecoveryKey, getDraftRecovery, clearDraftRecovery } from "./model/draft-recovery";
export type { ProductListRow } from "./model/product-list-view";
export {
  sellerProductKeys,
  productListOptions,
  sellerProductDetailOptions,
  sellerProductDelete,
  sellerProductCreateAction,
  sellerProductUpdateAction,
  sellerProductPublishAction,
} from "./api/query-options";
