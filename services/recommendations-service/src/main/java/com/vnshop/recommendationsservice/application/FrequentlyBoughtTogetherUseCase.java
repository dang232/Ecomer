package com.vnshop.recommendationsservice.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * "Frequently bought together" recommender. We take the top-N products that
 * have appeared in the same orders as the source product (ordered by their
 * co-purchase count) and enrich each one via product-service. Co-purchase
 * counts are maintained by the {@code order.created} Kafka listener — see
 * the recommendations-service infrastructure layer.
 *
 * <p>If an enrichment lookup misses (e.g. the product was deleted) we
 * silently drop the row from the response. We never want to surface a
 * stale id with no name/image to the FE.
 *
 * <p><b>Cold-start fallback:</b> on day-1 deploy and for products that
 * haven't been co-purchased yet, the co-purchase index is empty. Returning
 * an empty list collapses the section on the FE — bad first impression.
 * As a fallback we fetch top products in the same category (excluding the
 * source itself), giving the FE something coherent to render. The signal
 * is weaker but the surface stays alive while real co-purchase data accrues.
 */
public class FrequentlyBoughtTogetherUseCase {
    private final CoPurchasePort coPurchasePort;
    private final ProductServicePort productServicePort;

    public FrequentlyBoughtTogetherUseCase(
            CoPurchasePort coPurchasePort,
            ProductServicePort productServicePort
    ) {
        this.coPurchasePort = Objects.requireNonNull(coPurchasePort, "coPurchasePort is required");
        this.productServicePort = Objects.requireNonNull(productServicePort, "productServicePort is required");
    }

    public List<ProductProjection> findFor(String productId, int limit) {
        if (productId == null || productId.isBlank()) {
            throw new IllegalArgumentException("productId is required");
        }
        if (limit <= 0) {
            return List.of();
        }
        List<CoPurchase> rows = coPurchasePort.findTopByProductA(productId, limit);
        if (rows.isEmpty()) {
            return coldStartFallback(productId, limit);
        }
        List<ProductProjection> enriched = new ArrayList<>(rows.size());
        for (CoPurchase row : rows) {
            productServicePort.findById(row.productB()).ifPresent(enriched::add);
        }
        return List.copyOf(enriched);
    }

    /**
     * Same-category popularity. Skipped when the source product has no
     * category metadata (very unusual — the catalog requires it) since we
     * have nothing to filter against.
     */
    private List<ProductProjection> coldStartFallback(String productId, int limit) {
        ProductProjection source = productServicePort.findById(productId).orElse(null);
        if (source == null) return List.of();
        String categoryId = source.categoryId();
        if (categoryId == null || categoryId.isBlank()) return List.of();
        // Fetch limit + 1 so the source itself can be filtered out without
        // shrinking the result.
        return productServicePort.listByCategory(categoryId, limit + 1).stream()
                .filter(p -> !productId.equals(p.id()))
                .limit(limit)
                .toList();
    }
}
