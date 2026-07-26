package com.vnshop.orderservice.domain.finance.eventmode;

import java.util.Objects;

/**
 * Reads {@code SELLER_FINANCE_EVENT_MODE} with strict parsing and validates
 * the legacy boolean aliases that older milestones still carry. It is the
 * single source of truth for whether adjustment publishers should emit
 * events for any of the six adjustment types.
 *
 * <p>Validation rules (Repository-Grounded Decisions §4):
 * <ul>
 *   <li>Unknown mode values throw {@link IllegalStateException} at startup —
 *       no silent fallback to {@code OFF}.</li>
 *   <li>When {@code SELLER_FINANCE_ADJUSTMENTS_ENABLED=true} is supplied but
 *       the mode is {@code OFF}, the alias conflicts with the mode and the
 *       policy fails startup.</li>
 *   <li>{@code SHADOW} requires the consumer alias to be enabled and forbids
 *       the legacy order-created direct wallet alias.</li>
 *   <li>{@code PRIMARY} forbids the legacy order-created direct wallet alias
 *       so the versioned path is the only authoritative mutation.</li>
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
     * Convenience factory used by legacy wiring that does not yet inject the
     * canonical mode. Equivalent to {@code fromProperty("OFF", false, false, false)}
     * — no events are published and every legacy alias is treated as off.
     */
    public static SellerFinanceEventModePolicy disabled() {
        return fromMode(SellerFinanceEventMode.OFF, false, false, false);
    }

    /**
     * Compatibility factory that maps the legacy adjustment flag onto the canonical mode.
     * {@code true} maps to {@code PRIMARY}, {@code false} maps to {@code OFF}.
     * Used only by legacy constructors; new wiring must inject the policy.
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
     * Whether publishers should stage an outbox event for any of the six
     * adjustment types. Returns true for SHADOW and PRIMARY; false for OFF.
     */
    public boolean shouldPublish() {
        return mode != SellerFinanceEventMode.OFF;
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
