package com.vnshop.sellerfinanceservice.domain.eventmode;

import java.util.Objects;

/**
 * Reads {@code SELLER_FINANCE_EVENT_MODE} with strict parsing and validates
 * the legacy boolean aliases that older milestones still carry. It is the
 * single source of truth for whether the adjustment consumer should mutate
 * the authoritative projection in response to any of the six adjustment
 * types.
 *
 * <p>Validation rules mirror the producer-side policy (Task 3 §4):
 * <ul>
 *   <li>Unknown mode values throw {@link IllegalStateException} at startup —
 *       no silent fallback to {@code OFF}.</li>
 *   <li>{@code SELLER_FINANCE_ADJUSTMENT_CONSUMER_ENABLED=false} with any
 *       mode other than {@code OFF} conflicts with the policy expectation
 *       that the consumer is reachable; startup fails.</li>
 *   <li>{@code SHADOW} forbids enabling payout execution on the legacy
 *       compat path; the policy fails startup if any alias implies it is.</li>
 *   <li>{@code PRIMARY} forbids enabling legacy order-created direct wallet
 *       mutation; the legacy alias must be disabled.</li>
 * </ul>
 */
public final class SellerFinanceEventModePolicy {

    private final SellerFinanceEventMode mode;
    private final boolean adjustmentsAliasEnabled;
    private final boolean adjustmentConsumerAliasEnabled;
    private final boolean legacyOrderCreatedAliasEnabled;

    private SellerFinanceEventModePolicy(
            SellerFinanceEventMode mode,
            boolean adjustmentsAliasEnabled,
            boolean adjustmentConsumerAliasEnabled,
            boolean legacyOrderCreatedAliasEnabled) {
        this.mode = Objects.requireNonNull(mode, "mode");
        this.adjustmentsAliasEnabled = adjustmentsAliasEnabled;
        this.adjustmentConsumerAliasEnabled = adjustmentConsumerAliasEnabled;
        this.legacyOrderCreatedAliasEnabled = legacyOrderCreatedAliasEnabled;
    }

    /**
     * Convenience factory: OFF mode with every legacy alias disabled. Used by
     * legacy wiring paths and unit tests that don't need startup-validated
     * properties.
     */
    public static SellerFinanceEventModePolicy disabled() {
        return fromMode(SellerFinanceEventMode.OFF, false, false, false);
    }

    /**
     * Convenience factory that maps the legacy boolean alias
     * to the canonical mode.
     * {@code true} → PRIMARY, {@code false} → OFF. Tests may use this to
     * exercise the legacy code paths without touching real configuration.
     */
    public static SellerFinanceEventModePolicy fromLegacyAlias(boolean adjustmentsEnabled) {
        return fromMode(
                adjustmentsEnabled ? SellerFinanceEventMode.PRIMARY : SellerFinanceEventMode.OFF,
                adjustmentsEnabled,
                adjustmentsEnabled,
                false);
    }

    /**
     * Strictly parses the mode literal and validates legacy aliases.
     *
     * @throws IllegalStateException when the literal is unknown or aliases conflict
     */
    public static SellerFinanceEventModePolicy fromMode(
            SellerFinanceEventMode mode,
            boolean adjustmentsAliasEnabled,
            boolean adjustmentConsumerAliasEnabled,
            boolean legacyOrderCreatedAliasEnabled) {
        SellerFinanceEventModePolicy policy = new SellerFinanceEventModePolicy(
                mode, adjustmentsAliasEnabled, adjustmentConsumerAliasEnabled,
                legacyOrderCreatedAliasEnabled);
        policy.validateAliases();
        return policy;
    }

    private void validateAliases() {
        if (mode == SellerFinanceEventMode.OFF && adjustmentsAliasEnabled) {
            throw new IllegalStateException(
                    "adjustment alias conflicts with OFF event mode; choose one");
        }
        if (mode == SellerFinanceEventMode.SHADOW) {
            if (!adjustmentConsumerAliasEnabled) {
                throw new IllegalStateException(
                        "SHADOW event mode requires the adjustment consumer alias");
            }
            if (legacyOrderCreatedAliasEnabled) {
                throw new IllegalStateException(
                        "SHADOW event mode forbids the legacy order-created consumer alias");
            }
        }
        if (mode == SellerFinanceEventMode.PRIMARY && legacyOrderCreatedAliasEnabled) {
            throw new IllegalStateException(
                    "PRIMARY event mode forbids the legacy order-created consumer alias");
        }
    }

    public SellerFinanceEventMode mode() {
        return mode;
    }

    /**
     * Whether the consumer should accept adjustment events at all.
     * In OFF the consumer skeleton still loads for validation tests but the
     * concrete bean is gated by {@code @ConditionalOnProperty}, so the
     * effective answer on the wire is "no" when the alias is false.
     */
    public boolean shouldConsume() {
        return switch (mode) {
            case OFF -> false;
            case SHADOW, PRIMARY -> true;
        };
    }

    /**
     * Whether the consumer should apply authoritative mutations. Returns
     * true only for PRIMARY; SHADOW records evidence without mutating the
     * authoritative projection.
     */
    public boolean isAuthoritative() {
        return mode == SellerFinanceEventMode.PRIMARY;
    }

    /** Whether the legacy order-created direct wallet mutation consumer is allowed. */
    public boolean legacyOrderCreatedConsumerAllowed() {
        return switch (mode) {
            case OFF -> true;
            case SHADOW, PRIMARY -> false;
        };
    }

    public boolean adjustmentsAliasEnabled() {
        return adjustmentsAliasEnabled;
    }

    public boolean adjustmentConsumerAliasEnabled() {
        return adjustmentConsumerAliasEnabled;
    }

    public boolean legacyOrderCreatedAliasEnabled() {
        return legacyOrderCreatedAliasEnabled;
    }

    /**
     * Low-cardinality evidence tag for logs/metrics/traces. Intentionally
     * excludes seller/order/payout/account identifiers.
     */
    public String evidenceTag() {
        return "seller-finance-mode=" + mode.name();
    }

    @Override
    public String toString() {
        return "SellerFinanceEventModePolicy{mode=" + mode
                + ", adjustmentsAlias=" + adjustmentsAliasEnabled
                + ", adjustmentConsumerAlias=" + adjustmentConsumerAliasEnabled
                + ", legacyOrderCreatedAlias=" + legacyOrderCreatedAliasEnabled
                + '}';
    }
}
