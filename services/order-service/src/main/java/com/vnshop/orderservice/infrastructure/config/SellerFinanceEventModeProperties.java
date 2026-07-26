package com.vnshop.orderservice.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Typed binding for the seller-finance event rollout switches. */
@ConfigurationProperties(prefix = "seller-finance")
public record SellerFinanceEventModeProperties(
        String eventMode,
        Adjustments adjustments,
        AdjustmentConsumer adjustmentConsumer,
        LegacyOrderCreatedConsumer legacyOrderCreatedConsumer) {

    public record Adjustments(boolean enabled) {
    }

    public record AdjustmentConsumer(boolean enabled) {
    }

    public record LegacyOrderCreatedConsumer(boolean enabled) {
    }

    public SellerFinanceEventModeProperties {
        if (eventMode == null || eventMode.isBlank()) {
            throw new IllegalStateException("seller-finance.event-mode must be configured");
        }
        if (adjustments == null) {
            throw new IllegalStateException("seller-finance.adjustments must be configured");
        }
        if (adjustmentConsumer == null) {
            throw new IllegalStateException("seller-finance.adjustment-consumer must be configured");
        }
        if (legacyOrderCreatedConsumer == null) {
            throw new IllegalStateException("seller-finance.legacy-order-created-consumer must be configured");
        }
    }
}
