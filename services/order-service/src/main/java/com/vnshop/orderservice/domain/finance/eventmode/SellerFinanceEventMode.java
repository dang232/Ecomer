package com.vnshop.orderservice.domain.finance.eventmode;

/**
 * Central deployment setting that controls how order-service publishes
 * immutable seller-finance adjustment events to seller-finance-service.
 *
 * <p>Strict parsing rejects unknown values; there is no silent fallback.
 * rejects unknown values; there is no silent fallback. The mode is the single
 * source of truth for whether {@code CREDIT}, {@code RELEASE},
 * {@code REFUND_REVERSAL}, {@code CHARGEBACK_HOLD}, {@code CHARGEBACK_RELEASE},
 * and {@code CHARGEBACK_FINALIZE} adjustments are produced.
 *
 * <p>Legacy booleans from earlier milestones are retained only as deprecated
 * compatibility aliases: {@code SELLER_FINANCE_ADJUSTMENTS_ENABLED},
 * {@code SELLER_FINANCE_ADJUSTMENT_CONSUMER_ENABLED}, and
 * {@code SELLER_FINANCE_LEGACY_ORDER_CREATED_CONSUMER_ENABLED}. When an alias
 * conflicts with the explicit mode, the policy fails startup so the operator
 * cannot accidentally leave an inconsistent mix.
 */
public enum SellerFinanceEventMode {
    /** Versioned adjustments are not produced. Legacy listeners remain the authoritative path. */
    OFF,
    /** Versioned adjustments are produced and validated; payout execution is not enabled. */
    SHADOW,
    /** Versioned adjustments are authoritative; legacy direct wallet mutation is disabled. */
    PRIMARY;

    public static SellerFinanceEventMode parse(String literal) {
        if (literal == null || literal.isBlank()) {
            throw new IllegalStateException("seller-finance event mode is required");
        }
        try {
            return valueOf(literal.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("unsupported seller-finance event mode: " + literal, ex);
        }
    }
}
