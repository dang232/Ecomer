package com.vnshop.sellerfinanceservice.domain.eventmode;

/**
 * Central deployment setting that controls how seller-finance-service
 * consumes immutable seller-finance adjustment events from order-service.
 *
 * <p>Strict parsing rejects unknown values; there is no silent fallback.
 * rejects unknown values; there is no silent fallback. The mode is the single
 * source of truth for whether the consumer mutates the authoritative
 * projection in response to {@code CREDIT}, {@code RELEASE},
 * {@code REFUND_REVERSAL}, {@code CHARGEBACK_HOLD}, {@code CHARGEBACK_RELEASE},
 * and {@code CHARGEBACK_FINALIZE} adjustments.
 *
 * <p>Legacy booleans from earlier milestones are retained only as deprecated
 * compatibility aliases. When an alias conflicts with the explicit mode, the
 * policy fails startup so the operator cannot accidentally leave an
 * inconsistent mix.
 */
public enum SellerFinanceEventMode {
    /** Versioned adjustments are not consumed; legacy listeners remain authoritative. */
    OFF,
    /** Versioned adjustments are consumed for validation/evidence; legacy path remains authoritative. */
    SHADOW,
    /** Versioned adjustments are the authoritative mutation; legacy direct wallet mutation is disabled. */
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
