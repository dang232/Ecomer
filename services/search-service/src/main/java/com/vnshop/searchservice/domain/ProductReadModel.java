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
    private Float averageRating;
    private Integer reviewCount;
    private int variantCount;
    private String imageUrl;
    private int stock;
    private Instant createdAt;
    private boolean sameDayDelivery;
    private boolean verified;
    private boolean isOfficial;

    public ProductReadModel() {
    }

    public ProductReadModel(String productId, String name, String description, String categoryId, String brand, String status,
            BigDecimal minPrice, BigDecimal maxPrice, int variantCount, String imageUrl, int stock, Instant createdAt,
            boolean sameDayDelivery, boolean verified, boolean isOfficial) {
        this(productId, name, description, categoryId, brand, status, minPrice, maxPrice, null, null,
                variantCount, imageUrl, stock, createdAt, sameDayDelivery, verified, isOfficial);
    }

    public ProductReadModel(String productId, String name, String description, String categoryId, String brand, String status,
            BigDecimal minPrice, BigDecimal maxPrice, Float averageRating, Integer reviewCount,
            int variantCount, String imageUrl, int stock, Instant createdAt, boolean sameDayDelivery,
            boolean verified, boolean isOfficial) {
        this.productId = productId;
        this.name = name;
        this.description = description;
        this.categoryId = categoryId;
        this.brand = brand;
        this.status = status;
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.averageRating = averageRating;
        this.reviewCount = reviewCount;
        this.variantCount = variantCount;
        this.imageUrl = imageUrl;
        this.stock = stock;
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

    public Float averageRating() {
        return averageRating;
    }

    public Integer reviewCount() {
        return reviewCount;
    }

    public int variantCount() {
        return variantCount;
    }

    public String imageUrl() {
        return imageUrl;
    }

    public int stock() {
        return stock;
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
