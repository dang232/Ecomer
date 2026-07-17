package com.vnshop.inventoryservice.infrastructure.flash;

import com.vnshop.inventoryservice.application.ActiveFlashSaleCampaignView;
import java.math.BigDecimal;

/**
 * FE-facing shape for one active campaign. Mirrors {@link ActiveFlashSaleCampaignView}
 * but lives in the web layer so we can evolve the wire shape independently.
 */
public record ActiveFlashSaleCampaignResponse(
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

    static ActiveFlashSaleCampaignResponse from(ActiveFlashSaleCampaignView view) {
        return new ActiveFlashSaleCampaignResponse(
                view.id(),
                view.productId(),
                view.originalPrice(),
                view.salePrice(),
                view.stockTotal(),
                view.stockRemaining(),
                view.endsAt(),
                view.name(),
                view.shopName(),
                view.isShopOfficial(),
                view.isShopPreferred(),
                view.rawDiscount(),
                view.discount(),
                view.imageHash());
    }
}
