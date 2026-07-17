package com.vnshop.inventoryservice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One product on flash sale within a [startsAt, endsAt) window. {@code stockTotal}
 * is the cap allocated when the campaign was created; live remaining stock
 * lives in Redis (read-time join in the use case).
 */
public record FlashSaleCampaign(
        UUID id,
        String productId,
        BigDecimal originalPrice,
        BigDecimal salePrice,
        int stockTotal,
        Instant startsAt,
        Instant endsAt,
        boolean active,
        String name,
        String shopName,
        boolean isShopOfficial,
        boolean isShopPreferred,
        int rawDiscount,
        String discount,
        String imageHash) {
}
