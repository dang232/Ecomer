package com.vnshop.orderservice.application.shipping;

import java.util.List;

/**
 * Explicit outcomes for a shipping quote lookup. An empty option list is only
 * valid when the dependency answered successfully with no available options.
 */
public sealed interface ShippingQuoteResult
        permits ShippingQuoteResult.Success, ShippingQuoteResult.NoOptions,
        ShippingQuoteResult.DependencyUnavailable, ShippingQuoteResult.InvalidParcelMetadata {

    record Success(List<ShippingOption> options) implements ShippingQuoteResult {
        public Success {
            options = List.copyOf(options);
        }
    }

    record NoOptions() implements ShippingQuoteResult {
    }

    record DependencyUnavailable(String reason) implements ShippingQuoteResult {
    }

    record InvalidParcelMetadata(String reason) implements ShippingQuoteResult {
    }
}
