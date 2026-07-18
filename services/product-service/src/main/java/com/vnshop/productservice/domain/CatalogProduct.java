package com.vnshop.productservice.domain;

import java.math.BigDecimal;
import java.time.Instant;

public record CatalogProduct(Product product, Instant createdAt, BigDecimal minPrice) {
}
