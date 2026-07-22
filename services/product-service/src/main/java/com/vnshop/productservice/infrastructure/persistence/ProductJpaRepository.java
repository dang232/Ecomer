package com.vnshop.productservice.infrastructure.persistence;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.CatalogProduct;
import com.vnshop.productservice.application.CatalogCursor;
import com.vnshop.productservice.application.CatalogCursorSort;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.math.BigDecimal;
import java.util.ArrayList;

@Repository
public class ProductJpaRepository implements ProductRepositoryPort {
    private final ProductJpaSpringDataRepository springDataRepository;

    public ProductJpaRepository(ProductJpaSpringDataRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    @CacheEvict(value = "product", key = "#product.productId()")
    public Product save(Product product) {
        return springDataRepository.save(ProductJpaEntity.fromDomain(product)).toDomain();
    }

    @Override
    @Cacheable(value = "product", key = "#productId", unless = "#result == null")
    public Optional<Product> findById(UUID productId) {
        return springDataRepository.findById(productId).map(ProductJpaEntity::toDomain);
    }

    @Override
    public Map<String, String> findNamesByIds(Set<String> productIds) {
        if (productIds == null || productIds.isEmpty()) {
            return Map.of();
        }
        List<UUID> ids = productIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .map(this::parseUuid)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .toList();
        Map<String, String> names = new HashMap<>();
        springDataRepository.findAllById(ids).forEach(entity -> names.put(entity.getId().toString(), entity.getName()));
        return names;
    }

    @Override
    public List<Product> findBySellerId(String sellerId) {
        return springDataRepository.findBySellerId(sellerId).stream().map(ProductJpaEntity::toDomain).toList();
    }

    @Override
    public List<Product> findByCategory(String categoryId) {
        return springDataRepository.findByCategoryId(categoryId).stream().map(ProductJpaEntity::toDomain).toList();
    }

    @Override
    public List<Product> searchByName(String name) {
        return springDataRepository.searchByName(name == null ? "" : name).stream().map(ProductJpaEntity::toDomain).toList();
    }

    @Override
    public List<String> findDistinctCategories() {
        return springDataRepository.findDistinctCategories();
    }

    @Override
    public Page<Product> findCatalog(String categoryId, String q, String sellerId, Pageable pageable) {
        String normalizedCategory = (categoryId == null || categoryId.isBlank()) ? null : categoryId;
        String normalizedQuery = (q == null || q.isBlank()) ? null : q;
        String normalizedSeller = (sellerId == null || sellerId.isBlank()) ? null : sellerId;
        return springDataRepository.findCatalog(normalizedCategory, normalizedQuery, normalizedSeller, pageable)
                .map(ProductJpaEntity::toDomain);
    }

    @Override
    public List<CatalogProduct> findCatalogAfter(
            String categoryId, String query, String brand,
            BigDecimal minPrice, BigDecimal maxPrice,
            Boolean sameDay, Boolean verifiedOnly, Boolean officialOnly,
            CatalogCursorSort sort, CatalogCursor cursor, int limit) {
        String normalizedCategory = blankToNull(categoryId);
        String normalizedQuery = blankToNull(query);
        String normalizedBrand = blankToNull(brand);
        Pageable pageable = Pageable.ofSize(limit);
        UUID anchorId = cursor == null ? null : UUID.fromString(cursor.productId());
        List<ProductJpaEntity> entities = switch (sort) {
            case NEWEST -> springDataRepository.findCatalogAfterNewest(
                    normalizedCategory, normalizedQuery, normalizedBrand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly,
                    cursor == null ? null : cursor.createdAt(), anchorId, pageable);
            case PRICE_LOW -> springDataRepository.findCatalogAfterPriceLow(
                    normalizedCategory, normalizedQuery, normalizedBrand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly,
                    cursor == null ? null : cursor.price(), anchorId, pageable);
            case PRICE_HIGH -> springDataRepository.findCatalogAfterPriceHigh(
                    normalizedCategory, normalizedQuery, normalizedBrand, minPrice, maxPrice,
                    sameDay, verifiedOnly, officialOnly,
                    cursor == null ? null : cursor.price(), anchorId, pageable);
        };
        return entities.stream().map(ProductJpaRepository::toCatalogProduct).toList();
    }

    @Override
    public long countBySellerId(String sellerId) {
        return springDataRepository.countBySellerId(sellerId);
    }

    @Override
    public Map<String, Long> countBySellerIds(Set<String> sellerIds) {
        Map<String, Long> result = new HashMap<>();
        // Pre-fill all requested sellers with zero defaults
        for (String id : sellerIds) {
            result.put(id, 0L);
        }
        if (sellerIds.isEmpty()) {
            return result;
        }
        List<Object[]> rows = springDataRepository.countBySellerIds(sellerIds);
        for (Object[] row : rows) {
            String sellerId = (String) row[0];
            long count = row[1] == null ? 0L : ((Number) row[1]).longValue();
            result.put(sellerId, count);
        }
        return result;
    }

    private static CatalogProduct toCatalogProduct(ProductJpaEntity entity) {
        Product product = entity.toDomain();
        BigDecimal minPrice = product.variants().stream()
                .map(variant -> variant.price().amount())
                .min(BigDecimal::compareTo)
                .orElse(null);
        return new CatalogProduct(product, entity.getCreatedAt(), minPrice);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private Optional<UUID> parseUuid(String value) {
        try {
            return Optional.of(UUID.fromString(value));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
