package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.ArrayList;

public class GetProductUseCase {
    private final ProductRepositoryPort productRepositoryPort;

    public GetProductUseCase(ProductRepositoryPort productRepositoryPort) {
        this.productRepositoryPort = Objects.requireNonNull(productRepositoryPort, "productRepositoryPort is required");
    }

    public ProductResponse findById(UUID productId) {
        return productRepositoryPort.findById(productId)
                .map(ProductResponse::fromDomain)
                .orElseThrow(() -> new IllegalArgumentException("product not found"));
    }

    public ProductResponse findPublicById(UUID productId) {
        return productRepositoryPort.findById(productId)
                .filter(product -> product.status().name().equals("ACTIVE"))
                .map(ProductResponse::fromDomain)
                .orElseThrow(() -> new IllegalArgumentException("product not found"));
    }

    public List<ProductResponse> findBySeller(String sellerId) {
        return productRepositoryPort.findBySellerId(sellerId).stream().map(ProductResponse::fromDomain).toList();
    }

    public List<ProductResponse> findByCategory(String categoryId) {
        return productRepositoryPort.findByCategory(categoryId).stream().map(ProductResponse::fromDomain).toList();
    }

    public List<ProductResponse> searchByName(String name) {
        return productRepositoryPort.searchByName(name).stream().map(ProductResponse::fromDomain).toList();
    }

    public List<String> findCategories() {
        return productRepositoryPort.findDistinctCategories();
    }

    public Page<ProductResponse> findCatalog(String categoryId, String q, String sellerId, Pageable pageable) {
        return productRepositoryPort.findCatalog(categoryId, q, sellerId, pageable).map(ProductResponse::fromDomain);
    }

    public CatalogV2Response findCatalogV2(CatalogV2Query query) {
        CatalogCursorCodec codec = new CatalogCursorCodec(
                System.getenv().getOrDefault("VNSHOP_PRODUCT_CURSOR_SECRET", "local-product-cursor-secret-change-me"));
        return findCatalogV2(query, codec);
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
        return new CatalogV2Response(page.stream().map(entry -> ProductResponse.fromDomain(entry.product())).toList(), nextCursor, hasMore);
    }
}
