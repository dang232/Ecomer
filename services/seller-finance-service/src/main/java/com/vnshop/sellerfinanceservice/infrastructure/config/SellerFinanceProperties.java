package com.vnshop.sellerfinanceservice.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "seller-finance")
public record SellerFinanceProperties(
        String eventMode,
        boolean adjustmentsEnabled,
        Feature adjustmentConsumer,
        Feature legacyOrderCreatedConsumer,
        String payoutExecutionMode,
        String payoutIdempotencyPrefix,
        SettlementRelease settlementRelease) {

    public record Feature(boolean enabled) {
    }

    public record SettlementRelease(boolean enabled, int batchSize, long pollIntervalMs) {
        public SettlementRelease {
            if (batchSize <= 0) throw new IllegalStateException("settlement release batch size must be positive");
            if (pollIntervalMs <= 0) throw new IllegalStateException("settlement release poll interval must be positive");
        }
    }

    public SellerFinanceProperties {
        required(eventMode, "seller-finance.event-mode");
        required(payoutExecutionMode, "seller-finance.payout-execution-mode");
        required(payoutIdempotencyPrefix, "seller-finance.payout-idempotency-prefix");
        if (adjustmentConsumer == null) throw new IllegalStateException("seller-finance.adjustment-consumer must be configured");
        if (legacyOrderCreatedConsumer == null) throw new IllegalStateException("seller-finance.legacy-order-created-consumer must be configured");
        if (settlementRelease == null) throw new IllegalStateException("seller-finance.settlement-release must be configured");
    }

    private static String required(String value, String propertyName) {
        if (value == null || value.isBlank()) throw new IllegalStateException(propertyName + " must be configured");
        return value;
    }
}
