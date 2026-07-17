package com.vnshop.inventoryservice.application;

import java.math.BigDecimal;

/**
 * Flat view returned by GET /flash-sale/active. Combines DB fields with live
 * Redis stock so the FE gets everything in one call.
 */
public record ActiveFlashSaleCampaignView(
        String id,
        String productId,
        BigDecimal originalPrice,
        BigDecimal salePrice,
        int stockTotal,
        long stockRemaining,
        String endsAt,
        String name,
        String shopName,
        boolean isShopOfficial,
        boolean isShopPreferred,
        int rawDiscount,
        String discount,
        String imageHash) {
}
