package com.vnshop.orderservice.infrastructure.web.admin;

import com.vnshop.orderservice.domain.TopProduct;

public record TopProductResponse(String productId, String name, long unitsSold) {
    static TopProductResponse fromDomain(TopProduct product) {
        return new TopProductResponse(product.productId(), product.name(), product.unitsSold());
    }
}
