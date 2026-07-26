package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.ProductReviewSummary;
import com.vnshop.productservice.domain.review.port.out.ProductRatingReadPort;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.ArrayList;
import java.util.Set;
import java.util.stream.Collectors;

public class GetProductUseCase {
    private final ProductRepositoryPort productRepositoryPort;
    private final ProductRatingReadPort productRatingReadPort;
    private final CatalogCursorCodec catalogCursorCodec;

    public GetProductUseCase(ProductRepositoryPort productRepositoryPort) {
        this(productRepositoryPort, new ProductRatingReadPort() {}, null);
    }

    public GetProductUseCase(ProductRepositoryPort productRepositoryPort, CatalogCursorCodec catalogCursorCodec) {
        this(productRepositoryPort, new ProductRatingReadPort() {}, catalogCursorCodec);
    }

    public GetProductUseCase(ProductRepositoryPort productRepositoryPort, ProductRatingReadPort productRatingReadPort) {
        this(productRepositoryPort, productRatingReadPort, null);
    }

    public GetProductUseCase(ProductRepositoryPort productRepositoryPort,
            ProductRatingReadPort productRatingReadPort,
            CatalogCursorCodec catalogCursorCodec) {
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
        this.productRatingReadPort = Objects.requireNonNull(productRatingReadPort, "productRatingReadPort is required");
        this.catalogCursorCodec = catalogCursorCodec;
    }

    public ProductResponse findById(UUID productId) {
        return productRepositoryPort.findById(productId)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("product not found"));
    }

    public ProductResponse findPublicById(UUID productId) {
        return productRepositoryPort.findById(productId)
                .filter(product -> product.status().name().equals("ACTIVE"))
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("product not found"));
    }

    public List<ProductResponse> findBySeller(String sellerId) {
        return toResponses(productRepositoryPort.findBySellerId(sellerId));
    }

    public List<ProductResponse> findByCategory(String categoryId) {
        return toResponses(productRepositoryPort.findByCategory(categoryId));
    }

    public List<ProductResponse> searchByName(String name) {
        return toResponses(productRepositoryPort.searchByName(name));
    }

    public List<String> findCategories() {
        return productRepositoryPort.findDistinctCategories();
    }

    public Page<ProductResponse> findCatalog(String categoryId, String q, String sellerId, Pageable pageable) {
        Page<Product> page = productRepositoryPort.findCatalog(categoryId, q, sellerId, pageable);
        Map<String, ProductReviewSummary> summaries = summariesFor(page.getContent());
        return page.map(product -> ProductResponse.fromDomain(product, summaryFor(product, summaries)));
    }

    public CatalogV2Response findCatalogV2(CatalogV2Query query) {
        if (catalogCursorCodec == null) {
            throw new IllegalStateException("product cursor codec is not configured");
        }
        return findCatalogV2(query, catalogCursorCodec);
    }

    CatalogV2Response findCatalogV2(CatalogV2Query query, CatalogCursorCodec codec) {
        CatalogCursor cursor = codec.decode(query.cursor(), query);
        List<com.vnshop.productservice.domain.CatalogProduct> rows = productRepositoryPort.findCatalogAfter(
                query.category(), query.query(), query.brand(), query.minPrice(), query.maxPrice(),
                query.sameDay(), query.verifiedOnly(), query.officialOnly(), query.sort(), cursor, query.limit() + 1);
        boolean hasMore = rows.size() > query.limit();
        List<com.vnshop.productservice.domain.CatalogProduct> page = hasMore
                ? new ArrayList<>(rows.subList(0, query.limit())) : rows;
        String nextCursor = hasMore ? codec.encode(query, page.getLast()) : null;
        List<Product> products = page.stream()
                .map(com.vnshop.productservice.domain.CatalogProduct::product)
                .toList();
        Map<String, ProductReviewSummary> summaries = summariesFor(products);
        return new CatalogV2Response(products.stream()
                .map(product -> ProductResponse.fromDomain(product, summaryFor(product, summaries)))
                .toList(), nextCursor, hasMore);
    }

    private ProductResponse toResponse(Product product) {
        return ProductResponse.fromDomain(product,
                productRatingReadPort.getProductReviewSummary(product.productId().toString()));
    }

    private List<ProductResponse> toResponses(Collection<Product> products) {
        Map<String, ProductReviewSummary> summaries = summariesFor(products);
        return products.stream()
                .map(product -> ProductResponse.fromDomain(product, summaryFor(product, summaries)))
                .toList();
    }

    private Map<String, ProductReviewSummary> summariesFor(Collection<Product> products) {
        if (products.isEmpty()) {
            return Map.of();
        }
        Set<String> productIds = products.stream()
                .map(product -> product.productId().toString())
                .collect(Collectors.toSet());
        Map<String, ProductReviewSummary> summaries = productRatingReadPort.getProductReviewSummaries(productIds);
        return summaries == null ? Map.of() : summaries;
    }

    private ProductReviewSummary summaryFor(Product product, Map<String, ProductReviewSummary> summaries) {
        return summaries.getOrDefault(product.productId().toString(), ProductReviewSummary.empty());
    }
}
