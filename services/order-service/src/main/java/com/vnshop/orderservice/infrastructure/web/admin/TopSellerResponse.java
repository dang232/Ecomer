package com.vnshop.orderservice.infrastructure.web.admin;

import com.vnshop.orderservice.domain.TopSeller;
import java.math.BigDecimal;

public record TopSellerResponse(String sellerId, String shopName, BigDecimal paidGmv) {
    static TopSellerResponse fromDomain(TopSeller seller) {
        return new TopSellerResponse(seller.sellerId(), seller.shopName(), seller.paidGmv());
    }
}
