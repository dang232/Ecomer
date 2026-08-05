package com.vnshop.productservice.domain.port.out;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.CatalogProduct;
import com.vnshop.productservice.domain.ProductStatus;
import com.vnshop.productservice.application.CatalogCursor;
import com.vnshop.productservice.application.CatalogCursorSort;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.Objects;

public interface ProductRepositoryPort {
    Product save(Product product);

    Optional<Product> findById(UUID productId);

    default Map<String, String> findNamesByIds(Set<String> productIds) {
        return Map.of();
    }

    List<Product> findBySellerId(String sellerId);

    /**
     * Seller management read. Implementations must scope by the authenticated
     * seller and keep deleted products out of the management view.
     *
     * <p>The default is deliberately retained for lightweight repository fakes;
     * the JPA adapter overrides it with a database-paged query.</p>
     */
    default Page<Product> findSellerProducts(
            String sellerId, String q, String categoryId, ProductStatus status, Pageable pageable) {
        List<Product> matching = findBySellerId(sellerId).stream()
                .filter(product -> !Objects.equals(product.status(), ProductStatus.DELETED))
                .filter(product -> q == null || q.isBlank()
                        || product.name().toLowerCase(Locale.ROOT)
                                .contains(q.toLowerCase(Locale.ROOT)))
                .filter(product -> categoryId == null || categoryId.isBlank()
                        || Objects.equals(product.categoryId(), categoryId))
                .filter(product -> status == null || product.status() == status)
                .toList();
        if (pageable == null || pageable.isUnpaged()) {
            return new PageImpl<>(matching);
        }
        int start = (int) Math.min(pageable.getOffset(), matching.size());
        int end = Math.min(start + pageable.getPageSize(), matching.size());
        return new PageImpl<>(matching.subList(start, end), pageable, matching.size());
    }

    /** Owner-scoped management detail; deleted rows must be treated as absent. */
    default Optional<Product> findByIdAndSellerId(UUID productId, String sellerId) {
        return findById(productId)
                .filter(product -> !Objects.equals(product.status(), ProductStatus.DELETED))
                .filter(product -> Objects.equals(product.sellerId(), sellerId));
    }

    List<Product> findByCategory(String categoryId);

    List<Product> searchByName(String name);

    List<String> findDistinctCategories();

    /**
     * Paged catalog query used by the buyer-facing GET /products endpoint.
     * <p>{@code categoryId}, {@code q}, and {@code sellerId} are all optional;
     * null/blank means the corresponding filter is skipped.
     */
    Page<Product> findCatalog(String categoryId, String q, String sellerId, Pageable pageable);

    default List<CatalogProduct> findCatalogAfter(
            String categoryId, String query, String brand,
            java.math.BigDecimal minPrice, java.math.BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly,
            CatalogCursorSort sort, CatalogCursor cursor, int limit) {
        throw new UnsupportedOperationException("v2 catalog is not available for this repository");
    }

    long countBySellerId(String sellerId);

    Map<String, Long> countBySellerIds(Set<String> sellerIds);
}
