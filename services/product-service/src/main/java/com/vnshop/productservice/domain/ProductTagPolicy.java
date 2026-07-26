package com.vnshop.productservice.domain;

public record ProductTagPolicy(int maxPerProduct, int maxLength, int maxTotalLength) {
    public ProductTagPolicy {
        if (maxPerProduct < 1 || maxLength < 1 || maxTotalLength < 1) {
            throw new IllegalArgumentException("product tag policy limits must be positive");
        }
    }
}
