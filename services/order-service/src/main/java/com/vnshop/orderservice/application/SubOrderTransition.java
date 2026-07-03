package com.vnshop.orderservice.application;

import java.util.UUID;

/**
 * Sealed interface representing a state transition to apply to a seller's sub-order.
 * Each case maps to one of the four original use cases (Accept, Reject, Ship, ConfirmDelivery).
 *
 * <p>The sealed hierarchy lets the use case route logic without instanceof / pattern-matching
 * on raw command objects, while keeping the transition intent explicit at the call site.
 */
public sealed interface SubOrderTransition
        permits SubOrderTransition.Accept,
                 SubOrderTransition.Reject,
                 SubOrderTransition.Ship,
                 SubOrderTransition.ConfirmDelivery {

    record Accept() implements SubOrderTransition {}

    record Reject() implements SubOrderTransition {}

    record Ship(String carrier, String trackingNumber) implements SubOrderTransition {
        public Ship {
            if (carrier == null || carrier.isBlank()) {
                throw new IllegalArgumentException("carrier is required");
            }
            if (trackingNumber == null || trackingNumber.isBlank()) {
                throw new IllegalArgumentException("trackingNumber is required");
            }
        }
    }

    record ConfirmDelivery(UUID subOrderId, String buyerId) implements SubOrderTransition {}
}
