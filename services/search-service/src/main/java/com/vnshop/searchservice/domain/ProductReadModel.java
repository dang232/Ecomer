package com.vnshop.searchservice.domain;

import java.math.BigDecimal;
import java.time.Instant;

public class ProductReadModel {
    private String productId;
    private String name;
    private String description;
    private String categoryId;
    private String brand;
    private String status;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private int variantCount;
    private Instant createdAt;
    private boolean sameDayDelivery;
    private boolean verified;
    private boolean isOfficial;

    public ProductReadModel() {
    }

    public ProductReadModel(String productId, String name, String description, String categoryId, String brand, String status, BigDecimal minPrice, BigDecimal maxPrice, int variantCount, Instant createdAt, boolean sameDayDelivery, boolean verified, boolean isOfficial) {
        this.productId = productId;
        this.name = name;
        this.description = description;
        this.categoryId = categoryId;
        this.brand = brand;
        this.status = status;
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.variantCount = variantCount;
        this.createdAt = createdAt;
        this.sameDayDelivery = sameDayDelivery;
        this.verified = verified;
        this.isOfficial = isOfficial;
    }

    public String productId() {
        return productId;
    }

    public String name() {
        return name;
    }

    public String description() {
        return description;
    }

    public String categoryId() {
        return categoryId;
    }

    public String brand() {
        return brand;
    }

    public String status() {
        return status;
    }

    public BigDecimal minPrice() {
        return minPrice;
    }

    public BigDecimal maxPrice() {
        return maxPrice;
    }

    public int variantCount() {
        return variantCount;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public boolean sameDayDelivery() {
        return sameDayDelivery;
    }

    public boolean verified() {
        return verified;
    }

    public boolean isOfficial() {
        return isOfficial;
    }
}
