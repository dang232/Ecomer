import type { ProductTileView } from "./product-tile";
import { ProductTile } from "./product-tile";

export interface ProductGridProps {
  products: readonly ProductTileView[];
  hrefForProduct?: (product: ProductTileView) => string;
}

export function ProductGrid({
  products,
  hrefForProduct = (product) => `/product/${product.id}`,
}: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductTile key={product.id} product={product} href={hrefForProduct(product)} />
      ))}
    </div>
  );
}
